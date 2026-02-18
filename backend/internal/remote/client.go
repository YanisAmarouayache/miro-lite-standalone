package remote

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type RemoteGraphQL interface {
	Do(ctx context.Context, query string, variables map[string]interface{}, resp interface{}) error
}

type HTTPRemoteGraphQL struct {
	Endpoint string
}

func (c *HTTPRemoteGraphQL) Do(ctx context.Context, query string, variables map[string]interface{}, resp interface{}) error {
	body := map[string]interface{}{
		"query":     query,
		"variables": variables,
	}
	b, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.Endpoint, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(res.Body)
		return fmt.Errorf("remote status %d: %s", res.StatusCode, string(bodyBytes))
	}

	var out struct {
		Data   json.RawMessage   `json:"data"`
		Errors []json.RawMessage `json:"errors"`
	}
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return err
	}
	if len(out.Errors) > 0 {
		return fmt.Errorf("remote error: %s", string(out.Errors[0]))
	}
	return json.Unmarshal(out.Data, resp)
}
