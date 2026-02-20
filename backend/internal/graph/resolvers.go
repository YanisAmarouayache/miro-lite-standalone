package graph

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"miro-lite-standalone/backend/internal/board"
	"miro-lite-standalone/backend/internal/graph/model"

	"github.com/google/uuid"
)

type Resolver struct {
	BoardService *board.Service
	mu          sync.RWMutex
	nextSubID   int
	subscribers map[string]map[int]chan *model.Board
}

func (r *Resolver) Query() QueryResolver       { return &queryResolver{r} }
func (r *Resolver) Mutation() MutationResolver { return &mutationResolver{r} }
func (r *Resolver) Subscription() SubscriptionResolver {
	return &subscriptionResolver{r}
}

type queryResolver struct{ *Resolver }

func (r *queryResolver) Board(ctx context.Context, id string) (*model.Board, error) {
	b, ok := r.BoardService.GetBoard(id)
	if !ok {
		return nil, nil
	}
	return boardToGraphQL(b), nil
}

func (r *queryResolver) Boards(ctx context.Context) ([]*model.Board, error) {
	boards := r.BoardService.ListBoards()
	result := make([]*model.Board, 0, len(boards))
	for _, b := range boards {
		result = append(result, boardToGraphQL(b))
	}
	return result, nil
}

type mutationResolver struct{ *Resolver }

func (r *mutationResolver) CreateBoard(ctx context.Context, title string) (*model.Board, error) {
	id := fmt.Sprintf("board-%s", uuid.NewString()[:8])
	b := r.BoardService.CreateBoard(id, title)
	r.publishBoardUpdated(b)
	return boardToGraphQL(b), nil
}

func (r *mutationResolver) AddStickyNote(ctx context.Context, boardID string, item model.AddStickyNoteInput) (*model.StickyNote, error) {
	color := "yellow"
	if item.Color != nil && *item.Color != "" {
		color = *item.Color
	}
	w, err := r.BoardService.AddWidget(boardID, board.Widget{
		ID:     fmt.Sprintf("widget-%s", uuid.NewString()[:8]),
		Type:   "text",
		X:      item.X,
		Y:      item.Y,
		Config: map[string]interface{}{"text": item.Text, "color": color},
	})
	if err != nil {
		return nil, err
	}
	if b, ok := r.BoardService.GetBoard(boardID); ok {
		r.publishBoardUpdated(b)
	}
	text, _ := w.Config["text"].(string)
	col, _ := w.Config["color"].(string)
	return &model.StickyNote{ID: w.ID, X: w.X, Y: w.Y, Text: text, Color: col}, nil
}

func (r *mutationResolver) SaveBoard(ctx context.Context, boardID string, version int, widgets []*model.WidgetInput) (*model.Board, error) {
	boardWidgets := make([]board.Widget, 0, len(widgets))
	for _, w := range widgets {
		var config map[string]interface{}
		if err := json.Unmarshal([]byte(w.ConfigJSON), &config); err != nil {
			config = map[string]interface{}{}
		}
		boardWidgets = append(boardWidgets, board.Widget{
			ID:     w.ID,
			Type:   w.Type,
			X:      w.X,
			Y:      w.Y,
			Width:  w.Width,
			Height: w.Height,
			Config: config,
		})
	}
	b, err := r.BoardService.SaveBoard(boardID, version, boardWidgets)
	if err != nil {
		return nil, err
	}
	r.publishBoardUpdated(b)
	return boardToGraphQL(b), nil
}

type subscriptionResolver struct{ *Resolver }

func (r *subscriptionResolver) BoardUpdated(ctx context.Context, boardID string) (<-chan *model.Board, error) {
	ch, subID := r.addSubscriber(boardID)
	go func() {
		<-ctx.Done()
		r.removeSubscriber(boardID, subID)
	}()
	return ch, nil
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func boardToGraphQL(b *board.Model) *model.Board {
	widgets := make([]*model.WidgetPayload, 0, len(b.Widgets))
	for _, w := range b.Widgets {
		widgets = append(widgets, widgetToPayload(w))
	}
	return &model.Board{
		ID:      b.ID,
		Title:   b.Title,
		Version: b.Version,
		Widgets: widgets,
	}
}

func widgetToPayload(w board.Widget) *model.WidgetPayload {
	rawConfig, err := json.Marshal(w.Config)
	if err != nil {
		rawConfig = []byte("{}")
	}
	return &model.WidgetPayload{
		ID:         w.ID,
		Type:       w.Type,
		X:          w.X,
		Y:          w.Y,
		Width:      w.Width,
		Height:     w.Height,
		ConfigJSON: string(rawConfig),
	}
}

func (r *Resolver) addSubscriber(boardID string) (chan *model.Board, int) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.subscribers == nil {
		r.subscribers = make(map[string]map[int]chan *model.Board)
	}
	if r.subscribers[boardID] == nil {
		r.subscribers[boardID] = make(map[int]chan *model.Board)
	}
	r.nextSubID++
	subID := r.nextSubID
	ch := make(chan *model.Board, 4)
	r.subscribers[boardID][subID] = ch
	return ch, subID
}

func (r *Resolver) removeSubscriber(boardID string, subID int) {
	r.mu.Lock()
	defer r.mu.Unlock()
	boardSubs, ok := r.subscribers[boardID]
	if !ok {
		return
	}
	ch, ok := boardSubs[subID]
	if !ok {
		return
	}
	delete(boardSubs, subID)
	close(ch)
	if len(boardSubs) == 0 {
		delete(r.subscribers, boardID)
	}
}

func (r *Resolver) publishBoardUpdated(boardModel *board.Model) {
	if boardModel == nil {
		return
	}
	payload := boardToGraphQL(boardModel)

	r.mu.RLock()
	boardSubs := r.subscribers[boardModel.ID]
	channels := make([]chan *model.Board, 0, len(boardSubs))
	for _, ch := range boardSubs {
		channels = append(channels, ch)
	}
	r.mu.RUnlock()

	for _, ch := range channels {
		select {
		case ch <- payload:
		default:
		}
	}
}
