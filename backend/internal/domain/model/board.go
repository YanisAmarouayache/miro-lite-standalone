package model

type Widget struct {
	ID     string                 `json:"id"`
	Type   string                 `json:"type"`
	X      float64                `json:"x"`
	Y      float64                `json:"y"`
	Width  float64                `json:"width"`
	Height float64                `json:"height"`
	Config map[string]interface{} `json:"config"`
}

type Board struct {
	ID      string   `json:"id"`
	Title   string   `json:"title"`
	Version int      `json:"version"`
	Widgets []Widget `json:"widgets"`
}
