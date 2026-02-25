package graphql

import (
	"encoding/json"

	domainmodel "miro-lite-standalone/backend/internal/domain/model"
	"miro-lite-standalone/backend/internal/user-side/graphql/model"
)

func boardToGraphQL(b *domainmodel.Board) *model.Board {
	widgets := make([]*model.WidgetPayload, 0, len(b.Widgets))
	for _, w := range b.Widgets {
		widgets = append(widgets, widgetToPayload(w))
	}
	return &model.Board{
		ID:      b.ID,
		Title:   b.Title,
		Version: b.Version,
		Widgets: widgets,
	}
}

func widgetToPayload(w domainmodel.Widget) *model.WidgetPayload {
	rawConfig, err := json.Marshal(w.Config)
	if err != nil {
		rawConfig = []byte("{}")
	}
	return &model.WidgetPayload{
		ID:         w.ID,
		Type:       w.Type,
		X:          w.X,
		Y:          w.Y,
		Width:      w.Width,
		Height:     w.Height,
		ConfigJSON: string(rawConfig),
	}
}
