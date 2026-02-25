package graphql

// Ce fichier est géré conjointement par gqlgen (stubs) et toi (implémentations).
// Ne pas supprimer les lignes générées en bas du fichier.

import (
	"context"
	"encoding/json"
	"fmt"

	domainmodel "miro-lite-standalone/backend/internal/domain/model"
	"miro-lite-standalone/backend/internal/user-side/graphql/model"

	"github.com/google/uuid"
)

func (r *mutationResolver) CreateBoard(ctx context.Context, title string) (*model.Board, error) {
	id := fmt.Sprintf("board-%s", uuid.NewString()[:8])
	b, err := r.BoardService.CreateBoard(id, title)
	if err != nil {
		return nil, err
	}
	return boardToGraphQL(b), nil
}

func (r *mutationResolver) SaveBoard(ctx context.Context, boardID string, version int, widgets []*model.WidgetInput) (*model.Board, error) {
	domainWidgets := make([]domainmodel.Widget, 0, len(widgets))
	for _, w := range widgets {
		var config map[string]interface{}
		if err := json.Unmarshal([]byte(w.ConfigJSON), &config); err != nil {
			config = map[string]interface{}{}
		}
		domainWidgets = append(domainWidgets, domainmodel.Widget{
			ID: w.ID, Type: w.Type,
			X: w.X, Y: w.Y,
			Width: w.Width, Height: w.Height,
			Config: config,
		})
	}
	b, err := r.BoardService.SaveBoard(boardID, version, domainWidgets)
	if err != nil {
		return nil, err
	}
	return boardToGraphQL(b), nil
}

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

func (r *subscriptionResolver) BoardUpdated(ctx context.Context, boardID string) (<-chan *model.Board, error) {
	out, subID := r.Hub.Add(ctx, boardID)
	go func() {
		<-ctx.Done()
		r.Hub.Remove(boardID, subID)
	}()
	return out, nil
}

// ─── Lignes gérées par gqlgen — ne pas modifier ───────────────────────────────

func (r *Resolver) Mutation() MutationResolver         { return &mutationResolver{r} }
func (r *Resolver) Query() QueryResolver               { return &queryResolver{r} }
func (r *Resolver) Subscription() SubscriptionResolver { return &subscriptionResolver{r} }

type mutationResolver struct{ *Resolver }
type queryResolver struct{ *Resolver }
type subscriptionResolver struct{ *Resolver }
