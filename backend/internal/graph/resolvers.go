package graph

import (
	"context"
	"encoding/json"
	"fmt"

	"miro-lite-standalone/backend/internal/board"
	"miro-lite-standalone/backend/internal/graph/model"

	"github.com/google/uuid"
)

type Resolver struct {
    BoardService *board.Service
}

func (r *Resolver) Query() QueryResolver    { return &queryResolver{r} }
func (r *Resolver) Mutation() MutationResolver { return &mutationResolver{r} }

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
    return boardToGraphQL(b), nil
}

func (r *mutationResolver) AddStickyNote(ctx context.Context, boardID string, item model.AddStickyNoteInput) (*model.StickyNote, error) {
    color := "yellow"
    if item.Color != nil && *item.Color != "" {
        color = *item.Color
    }
    w, err := r.BoardService.AddWidget(boardID, board.Widget{
        ID:   fmt.Sprintf("widget-%s", uuid.NewString()[:8]),
        Type: "sticky_note",
        X:    item.X,
        Y:    item.Y,
        Config: map[string]interface{}{"text": item.Text, "color": color},
    })
    if err != nil {
        return nil, err
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
    return boardToGraphQL(b), nil
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

func boardToGraphQL(b *board.Model) *model.Board {
    items := make([]model.Item, 0, len(b.Widgets))
    for _, w := range b.Widgets {
        if item := widgetToItem(w); item != nil {
            items = append(items, item)
        }
    }
    return &model.Board{ID: b.ID, Title: b.Title, Version: b.Version, Items: items}
}

func widgetToItem(w board.Widget) model.Item {
    text, _ := w.Config["text"].(string)
    color, _ := w.Config["color"].(string)
    if color == "" {
        color = "yellow"
    }
    return &model.StickyNote{ID: w.ID, X: w.X, Y: w.Y, Text: text, Color: color}
}
