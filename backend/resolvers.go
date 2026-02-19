package graph

// THIS CODE WILL BE UPDATED WITH SCHEMA CHANGES. PREVIOUS IMPLEMENTATION FOR SCHEMA CHANGES WILL BE KEPT IN THE COMMENT SECTION. IMPLEMENTATION FOR UNCHANGED SCHEMA WILL BE KEPT.

import (
	"context"
	"miro-lite-standalone/backend/internal/graph"
	"miro-lite-standalone/backend/internal/graph/model"
)

type Resolver struct{}

// CreateBoard is the resolver for the createBoard field.
func (r *mutationResolver) CreateBoard(ctx context.Context, title string) (*model.Board, error) {
	panic("not implemented")
}

// AddStickyNote is the resolver for the addStickyNote field.
func (r *mutationResolver) AddStickyNote(ctx context.Context, boardID string, item model.AddStickyNoteInput) (*model.StickyNote, error) {
	panic("not implemented")
}

// SaveBoard is the resolver for the saveBoard field.
func (r *mutationResolver) SaveBoard(ctx context.Context, boardID string, version int, widgets []*model.WidgetInput) (*model.Board, error) {
	panic("not implemented")
}

// Board is the resolver for the board field.
func (r *queryResolver) Board(ctx context.Context, id string) (*model.Board, error) {
	panic("not implemented")
}

// Boards is the resolver for the boards field.
func (r *queryResolver) Boards(ctx context.Context) ([]*model.Board, error) {
	panic("not implemented")
}

// Mutation returns graph.MutationResolver implementation.
func (r *Resolver) Mutation() graph.MutationResolver { return &mutationResolver{r} }

// Query returns graph.QueryResolver implementation.
func (r *Resolver) Query() graph.QueryResolver { return &queryResolver{r} }

type mutationResolver struct{ *Resolver }
type queryResolver struct{ *Resolver }

// !!! WARNING !!!
// The code below was going to be deleted when updating resolvers. It has been copied here so you have
// one last chance to move it out of harms way if you want. There are two reasons this happens:
//  - When renaming or deleting a resolver the old code will be put in here. You can safely delete
//    it when you're done.
//  - You have helper methods in this file. Move them out to keep these resolver files clean.
/*
	type Resolver struct{}
*/
