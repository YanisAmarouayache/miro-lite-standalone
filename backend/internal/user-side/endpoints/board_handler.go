package endpoints

import (
	"encoding/json"
	"net/http"
	"strings"

	"miro-lite-standalone/backend/internal/domain/model"
	"miro-lite-standalone/backend/internal/domain/services"
)

type saveRequest struct {
	Version int            `json:"version"`
	Widgets []model.Widget `json:"widgets"`
}

type BoardHandler struct {
	svc *services.BoardService
}

func NewBoardHandler(svc *services.BoardService) *BoardHandler {
	return &BoardHandler{svc: svc}
}

func (h *BoardHandler) Handle(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/boards/")
	if id == "" || strings.Contains(id, "/") {
		http.Error(w, "invalid board id", http.StatusBadRequest)
		return
	}
	switch r.Method {
	case http.MethodGet:
		h.handleGet(w, id)
	case http.MethodPut:
		h.handlePut(w, r, id)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *BoardHandler) handleGet(w http.ResponseWriter, id string) {
	board, ok := h.svc.GetBoard(id)
	if !ok {
		http.Error(w, "board not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(board)
}

func (h *BoardHandler) handlePut(w http.ResponseWriter, r *http.Request, id string) {
	var req saveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if _, err := h.svc.SaveBoard(id, req.Version, req.Widgets); err != nil {
		if strings.Contains(err.Error(), "version conflict") {
			http.Error(w, err.Error(), http.StatusConflict)
			return
		}
		http.Error(w, "failed to save board", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
