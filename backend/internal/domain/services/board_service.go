package services

import (
	"fmt"

	"miro-lite-standalone/backend/internal/domain/interfaces/ports"
	"miro-lite-standalone/backend/internal/domain/interfaces/repositories"
	"miro-lite-standalone/backend/internal/domain/model"
)

type BoardService struct {
	repo      repositories.BoardRepository
	publisher ports.BoardEventPort
}

func NewBoardService(repo repositories.BoardRepository, pub ports.BoardEventPort) *BoardService {
	return &BoardService{repo: repo, publisher: pub}
}

func (s *BoardService) GetBoard(id string) (*model.Board, bool) {
	return s.repo.Get(id)
}

func (s *BoardService) ListBoards() []*model.Board {
	return s.repo.List()
}

func (s *BoardService) CreateBoard(id, title string) (*model.Board, error) {
	b := model.Board{ID: id, Title: title, Version: 1, Widgets: []model.Widget{}}
	if err := s.repo.Save(b); err != nil {
		return nil, err
	}
	s.publisher.Publish(&b)
	return &b, nil
}

func (s *BoardService) SaveBoard(id string, version int, widgets []model.Widget) (*model.Board, error) {
	current, ok := s.repo.Get(id)
	if !ok {
		current = &model.Board{ID: id, Version: 1, Widgets: []model.Widget{}}
	}
	if version != current.Version {
		return nil, fmt.Errorf("version conflict: expected %d got %d", current.Version, version)
	}
	next := model.Board{
		ID:      id,
		Title:   current.Title,
		Version: current.Version + 1,
		Widgets: widgets,
	}
	if err := s.repo.Save(next); err != nil {
		return nil, err
	}
	s.publisher.Publish(&next)
	return &next, nil
}
