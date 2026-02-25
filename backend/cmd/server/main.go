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

	"miro-lite-standalone/backend/internal/board"
	"miro-lite-standalone/backend/internal/graph"
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
	addr := ":" + port

	svc := board.NewService(storePath)
	isProd := os.Getenv("ENV") == "production"

	// GraphQL
	resolver := graph.NewResolver(svc)
	gqlSrv := handler.New(graph.NewExecutableSchema(graph.Config{Resolvers: resolver}))
	gqlSrv.Use(extension.Introspection{})
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
				allowedOrigins := parseAllowedOrigins(os.Getenv("ALLOWED_ORIGINS"))
				return allowedOrigins[origin]
			},
		},
	})

	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("/api/boards/", svc.HandleBoard)

	mux.Handle("/graphql", gqlSrv)
	if !isProd {
		gqlSrv.Use(extension.Introspection{})
		mux.Handle("/playground", playground.Handler("GraphQL Playground", "/graphql"))
	} else {
		log.Println("introspection and playground disabled in production")
	}

	handler := withCORS(mux)

	log.Printf("backend listening on %s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}

	log.Println("backend listening on :8091")
	log.Println("GraphiQL playground → http://localhost:8091/playground")
	if err := http.ListenAndServe(":8091", handler); err != nil {
		log.Fatal(err)
	}
}

func withCORS(next http.Handler) http.Handler {
	allowedOrigins := parseAllowedOrigins(os.Getenv("ALLOWED_ORIGINS"))
	allowedHeaders := parseAllowedHeaders(os.Getenv("ALLOWED_HEADERS"))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		isAllowedOrigin := origin == "" || allowedOrigins[origin]

		if !isAllowedOrigin {
			rejectCORS(w, r)
			return
		}

		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}

		// Preflight OPTIONS
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Headers", allowedHeaders)
			w.Header().Set("Access-Control-Allow-Methods", "GET,PUT,POST,OPTIONS")
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// Rejette proprement en JSON si la route est /graphql, sinon texte brut
func rejectCORS(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/graphql") {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"errors":[{"message":"origin not allowed"}]}`))
		return
	}
	http.Error(w, "origin not allowed", http.StatusForbidden)
}

func parseAllowedOrigins(raw string) map[string]bool {
	if strings.TrimSpace(raw) == "" {
		// ← :8091 ajouté pour que le Playground fonctionne sans config
		raw = "http://localhost:4200,http://localhost:4201,http://localhost:8091"
	}
	origins := make(map[string]bool)
	for _, value := range strings.Split(raw, ",") {
		origin := strings.TrimSpace(value)
		if origin == "" {
			continue
		}
		origins[origin] = true
	}
	return origins
}

func parseAllowedHeaders(raw string) string {
	if strings.TrimSpace(raw) == "" {
		return "Content-Type,Authorization,Apollo-Require-Preflight,X-Requested-With,Accept,Origin"
	}

	headers := make([]string, 0)
	seen := make(map[string]bool)
	for _, value := range strings.Split(raw, ",") {
		header := strings.TrimSpace(value)
		if header == "" {
			continue
		}
		key := strings.ToLower(header)
		if seen[key] {
			continue
		}
		seen[key] = true
		headers = append(headers, header)
	}
	if len(headers) == 0 {
		return "Content-Type,Authorization,Apollo-Require-Preflight,X-Requested-With,Accept,Origin"
	}
	return strings.Join(headers, ",")
}
