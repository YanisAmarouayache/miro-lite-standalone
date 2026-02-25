package main

import (
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/gorilla/websocket"

	"miro-lite-standalone/backend/internal/domain/services"
	"miro-lite-standalone/backend/internal/server-side/pubsub"
	serverrepo "miro-lite-standalone/backend/internal/server-side/repositories"
	"miro-lite-standalone/backend/internal/user-side/endpoints"
	gql "miro-lite-standalone/backend/internal/user-side/graphql"
)

func getEnvOrDefault(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func main() {
	storePath := getEnvOrDefault("STORE_PATH", "data/boards.json")
	port := getEnvOrDefault("PORT", "8091")
	isProd := os.Getenv("ENV") == "production"

	// Infrastructure
	repo := serverrepo.NewBoardJSONRepository(storePath)
	bus := pubsub.NewBoardEventBus()

	// Domaine
	boardSvc := services.NewBoardService(repo, bus)

	// Transports
	hub := gql.NewSubscriptionHub(bus)
	resolver := gql.NewResolver(boardSvc, hub)

	// GraphQL
	gqlSrv := handler.New(gql.NewExecutableSchema(gql.Config{Resolvers: resolver}))
	gqlSrv.AddTransport(transport.Options{})
	gqlSrv.AddTransport(transport.GET{})
	gqlSrv.AddTransport(transport.POST{})
	gqlSrv.AddTransport(transport.MultipartForm{})
	gqlSrv.AddTransport(transport.Websocket{
		KeepAlivePingInterval: 15 * time.Second,
		Upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				origin := r.Header.Get("Origin")
				if origin == "" {
					return true
				}
				return parseAllowedOrigins(os.Getenv("ALLOWED_ORIGINS"))[origin]
			},
		},
	})

	if !isProd {
		gqlSrv.Use(extension.Introspection{})
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("/api/boards/", endpoints.NewBoardHandler(boardSvc).Handle)
	mux.Handle("/graphql", gqlSrv)
	if !isProd {
		mux.Handle("/playground", playground.Handler("GraphQL Playground", "/graphql"))
	}

	log.Printf("backend listening on :%s", port)
	if err := http.ListenAndServe(":"+port, withCORS(mux)); err != nil {
		log.Fatal(err)
	}
}
