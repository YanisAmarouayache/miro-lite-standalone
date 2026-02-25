package pubsub

import (
	"sync"

	"miro-lite-standalone/backend/internal/domain/model"
)

type BoardHandler func(board *model.Board)

type BoardEventBus struct {
	mu       sync.RWMutex
	handlers []BoardHandler
}

func NewBoardEventBus() *BoardEventBus {
	return &BoardEventBus{}
}

// Publish implémente domain/interfaces/ports.BoardEventPort
func (b *BoardEventBus) Publish(board *model.Board) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for _, h := range b.handlers {
		h(board)
	}
}

func (b *BoardEventBus) Subscribe(handler BoardHandler) (unsubscribe func()) {
	b.mu.Lock()
	defer b.mu.Unlock()
	idx := len(b.handlers)
	b.handlers = append(b.handlers, handler)
	return func() {
		b.mu.Lock()
		defer b.mu.Unlock()
		b.handlers = append(b.handlers[:idx], b.handlers[idx+1:]...)
	}
}
