package repositories

import (
	"encoding/json"
	"errors"
	"log"
	"os"
	"path/filepath"
	"sync"

	"miro-lite-standalone/backend/internal/domain/model"
)

type BoardJSONRepository struct {
	mu        sync.RWMutex
	boards    map[string]model.Board
	storePath string
}

func NewBoardJSONRepository(storePath string) *BoardJSONRepository {
	r := &BoardJSONRepository{
		boards:    make(map[string]model.Board),
		storePath: storePath,
	}
	r.loadFromDisk()
	return r
}

func (r *BoardJSONRepository) Get(id string) (*model.Board, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	b, ok := r.boards[id]
	if !ok {
		return nil, false
	}
	sanitize(&b)
	return &b, true
}

func (r *BoardJSONRepository) List() []*model.Board {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]*model.Board, 0, len(r.boards))
	for _, b := range r.boards {
		bCopy := b
		sanitize(&bCopy)
		result = append(result, &bCopy)
	}
	return result
}

func (r *BoardJSONRepository) Save(board model.Board) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	previous, hadPrevious := r.boards[board.ID]
	r.boards[board.ID] = board

	if err := r.saveToDisk(); err != nil {
		if hadPrevious {
			r.boards[board.ID] = previous
		} else {
			delete(r.boards, board.ID)
		}
		return err
	}
	return nil
}

func sanitize(b *model.Board) {
	for i := range b.Widgets {
		if b.Widgets[i].Config == nil {
			b.Widgets[i].Config = map[string]interface{}{}
		}
	}
}

func (r *BoardJSONRepository) loadFromDisk() {
	if r.storePath == "" {
		return
	}
	content, err := os.ReadFile(r.storePath)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			log.Printf("warn: could not read store %q: %v", r.storePath, err)
		}
		return
	}
	var persisted map[string]model.Board
	if err := json.Unmarshal(content, &persisted); err != nil {
		log.Printf("warn: corrupt store %q, starting empty: %v", r.storePath, err)
		return
	}
	r.boards = persisted
	log.Printf("loaded %d boards from %s", len(r.boards), r.storePath)
}

func (r *BoardJSONRepository) saveToDisk() error {
	if r.storePath == "" {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(r.storePath), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(r.boards, "", "  ")
	if err != nil {
		return err
	}
	tmp := r.storePath + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, r.storePath)
}
