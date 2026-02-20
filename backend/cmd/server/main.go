package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/playground"

	"miro-lite-standalone/backend/internal/board"
	"miro-lite-standalone/backend/internal/graph"
)

func main() {
	svc := board.NewService("data/boards.json")

	// GraphQL
	resolver := &graph.Resolver{BoardService: svc}
	gqlSrv := handler.NewDefaultServer(
		graph.NewExecutableSchema(graph.Config{Resolvers: resolver}),
	)

	mux := http.NewServeMux()

	// REST (inchangé)
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("/api/boards/", svc.HandleBoard)

	// GraphQL
	mux.Handle("/graphql", gqlSrv)
	mux.Handle("/playground", playground.Handler("GraphQL Playground", "/graphql"))

	handler := withCORS(mux)
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
		isAllowedOrigin := origin == "" || allowedOrigins[origin] // ← origin vide = same-server = OK

		if isAllowedOrigin && origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Headers", allowedHeaders)
		w.Header().Set("Access-Control-Allow-Methods", "GET,PUT,POST,OPTIONS")

		if r.Method == http.MethodOptions {
			if !isAllowedOrigin {
				rejectCORS(w, r)
				return
			}
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if !isAllowedOrigin {
			rejectCORS(w, r)
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
