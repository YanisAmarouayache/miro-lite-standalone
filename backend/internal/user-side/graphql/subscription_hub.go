package graphql

import (
	"context"
	"log"
	"sync"

	domainmodel "miro-lite-standalone/backend/internal/domain/model"
	"miro-lite-standalone/backend/internal/server-side/pubsub"
	"miro-lite-standalone/backend/internal/user-side/graphql/model"
)

type subscriberEntry struct {
	mu     sync.Mutex
	latest *model.Board
	notify chan struct{}
	out    chan *model.Board
}

type SubscriptionHub struct {
	mu          sync.RWMutex
	nextSubID   int
	subscribers map[string]map[int]*subscriberEntry
}

func NewSubscriptionHub(bus *pubsub.BoardEventBus) *SubscriptionHub {
	h := &SubscriptionHub{
		subscribers: make(map[string]map[int]*subscriberEntry),
	}
	bus.Subscribe(func(b *domainmodel.Board) {
		h.publish(b.ID, boardToGraphQL(b))
	})
	return h
}

func (h *SubscriptionHub) Add(ctx context.Context, boardID string) (<-chan *model.Board, int) {
	entry := &subscriberEntry{
		notify: make(chan struct{}, 1),
		out:    make(chan *model.Board, 1),
	}

	h.mu.Lock()
	if h.subscribers[boardID] == nil {
		h.subscribers[boardID] = make(map[int]*subscriberEntry)
	}
	h.nextSubID++
	subID := h.nextSubID
	h.subscribers[boardID][subID] = entry
	h.mu.Unlock()

	go func() {
		defer close(entry.out)
		for {
			select {
			case <-ctx.Done():
				return
			case <-entry.notify:
				entry.mu.Lock()
				b := entry.latest
				entry.mu.Unlock()
				select {
				case entry.out <- b:
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	return entry.out, subID
}

func (h *SubscriptionHub) Remove(boardID string, subID int) {
	h.mu.Lock()
	defer h.mu.Unlock()
	boardSubs, ok := h.subscribers[boardID]
	if !ok {
		return
	}
	delete(boardSubs, subID)
	if len(boardSubs) == 0 {
		delete(h.subscribers, boardID)
	}
}

func (h *SubscriptionHub) publish(boardID string, payload *model.Board) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for subID, entry := range h.subscribers[boardID] {
		entry.mu.Lock()
		entry.latest = payload
		entry.mu.Unlock()
		select {
		case entry.notify <- struct{}{}:
		default:
			log.Printf("info: coalescing update for subscriber %d on board %s", subID, boardID)
		}
	}
}
