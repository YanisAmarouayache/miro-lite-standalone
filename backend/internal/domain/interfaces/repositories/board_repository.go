package repositories

import "miro-lite-standalone/backend/internal/domain/model"

type BoardRepository interface {
	Get(id string) (*model.Board, bool)
	List() []*model.Board
	Save(board model.Board) error
}
