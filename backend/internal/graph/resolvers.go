package graph

import (
	"context"
	"fmt"

	"ton-backend/internal/graph/generated"
	"ton-backend/internal/graph/model"
	"ton-backend/internal/remote"
	"ton-backend/internal/whiteboard"
)

type Resolver struct {
	WhiteboardStore *whiteboard.Store
	Remote          remote.RemoteGraphQL
}

func (r *Resolver) Query() generated.QueryResolver {
	return &queryResolver{r}
}

func (r *Resolver) Mutation() generated.MutationResolver {
	return &mutationResolver{r}
}

type queryResolver struct{ *Resolver }

func (r *queryResolver) Board(ctx context.Context, id *string) (*model.Board, error) {
	if board, ok := r.WhiteboardStore.GetBoard(*id); ok {
		return board, nil
	}
	return nil, nil
}

func (r *queryResolver) Boards(ctx context.Context) ([]*model.Board, error) {
	// TODO: implémenter
	return nil, nil
}

type mutationResolver struct{ *Resolver }

func (r *mutationResolver) CreateBoard(ctx context.Context, title string) (*model.Board, error) {
	board := &model.Board{
		ID:    fmt.Sprintf("board-%d", len(r.WhiteboardStore.boards)+1),
		Title: title,
	}
	r.WhiteboardStore.SaveBoard(board)
	return board, nil
}

func (r *mutationResolver) AddStickyNote(ctx context.Context, boardId string, item model.AddStickyNoteInput) (*model.StickyNote, error) {
	// TODO: implémenter logique sticky note
	return nil, fmt.Errorf("not implemented")
}
