package graphql

import "miro-lite-standalone/backend/internal/domain/services"

type Resolver struct {
	BoardService *services.BoardService
	Hub          *SubscriptionHub
}

func NewResolver(svc *services.BoardService, hub *SubscriptionHub) *Resolver {
	return &Resolver{BoardService: svc, Hub: hub}
}
