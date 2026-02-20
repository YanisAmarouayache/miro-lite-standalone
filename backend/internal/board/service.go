package board

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

type Widget struct {
	ID     string                 `json:"id"`
	Type   string                 `json:"type"`
	X      float64                `json:"x"`
	Y      float64                `json:"y"`
	Width  float64                `json:"width"`
	Height float64                `json:"height"`
	Config map[string]interface{} `json:"config"`
	Text   string                 `json:"text,omitempty"`
}

type Model struct {
	ID      string   `json:"id"`
	Title   string   `json:"title"`
	Version int      `json:"version"`
	Widgets []Widget `json:"widgets"`
}

type SaveRequest struct {
	Version int      `json:"version"`
	Widgets []Widget `json:"widgets"`
}

type Service struct {
	mu        sync.RWMutex
	boards    map[string]Model
	storePath string
}

func NewService(storePath string) *Service {
	s := &Service{
		boards:    make(map[string]Model),
		storePath: storePath,
	}
	s.loadFromDisk()
	return s
}

// ─── Méthodes publiques pour les resolvers GraphQL ───────────────────────────

func (s *Service) GetBoard(id string) (*Model, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	b, ok := s.boards[id]
	if !ok {
		return nil, false
	}
	return &b, true
}

func (s *Service) ListBoards() []*Model {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*Model, 0, len(s.boards))
	for _, b := range s.boards {
		bCopy := b
		result = append(result, &bCopy)
	}
	return result
}

func (s *Service) CreateBoard(id, title string) *Model {
	s.mu.Lock()
	defer s.mu.Unlock()
	b := Model{ID: id, Title: title, Version: 1, Widgets: []Widget{}}
	s.boards[id] = b
	_ = s.saveToDisk()
	return &b
}

func (s *Service) AddWidget(boardID string, widget Widget) (*Widget, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	b, ok := s.boards[boardID]
	if !ok {
		return nil, fmt.Errorf("board %s not found", boardID)
	}
	normalizeWidget(&widget)
	b.Widgets = append(b.Widgets, widget)
	s.boards[boardID] = b
	if err := s.saveToDisk(); err != nil {
		return nil, err
	}
	return &widget, nil
}

func (s *Service) Count() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.boards)
}

// ─── Handlers REST (inchangés) ────────────────────────────────────────────────

func (s *Service) HandleBoard(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/boards/")
	if id == "" || strings.Contains(id, "/") {
		http.Error(w, "invalid board id", http.StatusBadRequest)
		return
	}
	switch r.Method {
	case http.MethodGet:
		s.handleGet(w, id)
	case http.MethodPut:
		s.handlePut(w, r, id)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Service) handleGet(w http.ResponseWriter, id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	board, ok := s.boards[id]
	if !ok {
		board = Model{ID: id, Version: 1, Widgets: []Widget{}}
		s.boards[id] = board
	}
	for i := range board.Widgets {
		normalizeWidget(&board.Widgets[i])
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(board)
}

func (s *Service) handlePut(w http.ResponseWriter, r *http.Request, id string) {
	var req SaveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	current, ok := s.boards[id]
	if !ok {
		current = Model{ID: id, Version: 1, Widgets: []Widget{}}
	}
	if req.Version != current.Version {
		http.Error(w, "version conflict", http.StatusConflict)
		return
	}
	for i := range req.Widgets {
		normalizeWidget(&req.Widgets[i])
	}
	next := Model{ID: id, Version: current.Version + 1, Widgets: req.Widgets}
	s.boards[id] = next
	if err := s.saveToDisk(); err != nil {
		http.Error(w, "failed to persist board", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Service) loadFromDisk() {
	if s.storePath == "" {
		return
	}
	content, err := os.ReadFile(s.storePath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return
		}
		return
	}
	var persisted map[string]Model
	if err := json.Unmarshal(content, &persisted); err != nil {
		return
	}
	s.boards = persisted
}

func (s *Service) saveToDisk() error {
	if s.storePath == "" {
		return nil
	}
	dir := filepath.Dir(s.storePath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(s.boards, "", "  ")
	if err != nil {
		return err
	}
	tempPath := s.storePath + ".tmp"
	if err := os.WriteFile(tempPath, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tempPath, s.storePath)
}

func normalizeWidget(widget *Widget) {
	if widget.Config == nil {
		widget.Config = map[string]interface{}{}
	}
	if widget.Text != "" {
		if _, exists := widget.Config["text"]; !exists {
			widget.Config["text"] = widget.Text
		}
		widget.Text = ""
	}
	if widget.Type == "note" {
		widget.Type = "text"
	}
}

func (s *Service) SaveBoard(id string, version int, widgets []Widget) (*Model, error) {
    s.mu.Lock()
    defer s.mu.Unlock()
    current, ok := s.boards[id]
    if !ok {
        current = Model{ID: id, Version: 1, Widgets: []Widget{}}
    }
    if version != current.Version {
        return nil, fmt.Errorf("version conflict: expected %d got %d", current.Version, version)
    }
    for i := range widgets {
        normalizeWidget(&widgets[i])
    }
    next := Model{ID: id, Title: current.Title, Version: current.Version + 1, Widgets: widgets}
    s.boards[id] = next
    if err := s.saveToDisk(); err != nil {
        return nil, err
    }
    return &next, nil
}
