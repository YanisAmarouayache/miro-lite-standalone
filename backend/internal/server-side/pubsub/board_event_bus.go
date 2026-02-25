package pubsub

import (
	"sync"

	"miro-lite-standalone/backend/internal/domain/model"
)

type BoardHandler func(board *model.Board)

type BoardEventBus struct {
	mu       sync.RWMutex
	nextID   int
	handlers map[int]BoardHandler
}

func NewBoardEventBus() *BoardEventBus {
	return &BoardEventBus{handlers: make(map[int]BoardHandler)}
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
	id := b.nextID
	b.nextID++
	b.handlers[id] = handler
	return func() {
		b.mu.Lock()
		defer b.mu.Unlock()
		delete(b.handlers, id)
	}
}
