package otel

import (
	"context"
	"encoding/json"
	"sync/atomic"
	"testing"
	"time"

	bifrost "github.com/maximhq/bifrost/core"
	"github.com/maximhq/bifrost/core/schemas"
)

type countingClient struct{ calls atomic.Int64 }

func (c *countingClient) Emit(_ context.Context, _ []*ResourceSpan) error {
	c.calls.Add(1)
	return nil
}
func (c *countingClient) Close() error { return nil }

func traceForVirtualKey(id, name string) *schemas.Trace {
	attempt := &schemas.Span{SpanID: "attempt", Name: "chat.completions", Attributes: map[string]any{}}
	if id != "" {
		attempt.Attributes[schemas.AttrBifrostVirtualKeyID] = id
	}
	if name != "" {
		attempt.Attributes[schemas.AttrBifrostVirtualKeyName] = name
	}
	root := &schemas.Span{SpanID: "root", Name: "bifrost.request", Attributes: map[string]any{}}
	return &schemas.Trace{TraceID: "trace-" + id + name, RootSpan: root, Spans: []*schemas.Span{root, attempt}}
}

// TestInject_ExcludedVirtualKeyIsNeverExported: a trace whose attempt span carries a
// listed virtual key — by id or by name — is dropped before any profile's client is
// called; every other trace, including one with no virtual key at all, still exports.
func TestInject_ExcludedVirtualKeyIsNeverExported(t *testing.T) {
	logger = bifrost.NewDefaultLogger(schemas.LogLevelError)
	client := &countingClient{}
	plugin := &OtelPlugin{
		targets:            []*otelTarget{testTarget(t, client, time.Second)},
		excludeVirtualKeys: virtualKeySet([]string{"vk-sweep", " by-name ", ""}),
	}
	cases := []struct {
		id, name string
		exported bool
	}{
		{"vk-sweep", "sweep", false},
		{"vk-other", "by-name", false},
		{"vk-other", "other", true},
		{"", "", true},
	}
	for _, c := range cases {
		before := client.calls.Load()
		if err := plugin.Inject(context.Background(), traceForVirtualKey(c.id, c.name)); err != nil {
			t.Fatalf("inject %s/%s: %v", c.id, c.name, err)
		}
		if got := client.calls.Load() > before; got != c.exported {
			t.Errorf("virtual key id=%q name=%q: exported=%v, want %v", c.id, c.name, got, c.exported)
		}
	}
}

// TestExcludedTrace_EmptyListMatchesNothing guards the default: with no list configured a
// trace with an empty-string key attribute must not be treated as excluded.
func TestExcludedTrace_EmptyListMatchesNothing(t *testing.T) {
	plugin := &OtelPlugin{excludeVirtualKeys: virtualKeySet(nil)}
	if plugin.excludedTrace(traceForVirtualKey("", "")) || plugin.excludedTrace(traceForVirtualKey("vk-a", "a")) {
		t.Fatal("empty exclude list excluded a trace")
	}
}

// TestConfigExcludeVirtualKeysRoundTrip: the list is read from both config shapes and
// survives MarshalForStorage (the config store copy) and Redacted (the API view).
func TestConfigExcludeVirtualKeysRoundTrip(t *testing.T) {
	for name, raw := range map[string]string{
		"profiles wrapper": `{"profiles":[{"collector_url":"http://c:4318","service_name":"s"}],"exclude_virtual_keys":["vk-sweep"]}`,
		"legacy profile":   `{"collector_url":"http://c:4318","service_name":"s","exclude_virtual_keys":["vk-sweep"]}`,
	} {
		t.Run(name, func(t *testing.T) {
			var cfg Config
			if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if len(cfg.ExcludeVirtualKeys) != 1 || cfg.ExcludeVirtualKeys[0] != "vk-sweep" {
				t.Fatalf("ExcludeVirtualKeys = %v, want [vk-sweep]", cfg.ExcludeVirtualKeys)
			}
			stored, err := cfg.MarshalForStorage()
			if err != nil {
				t.Fatalf("marshal for storage: %v", err)
			}
			var again Config
			if err := json.Unmarshal(stored, &again); err != nil {
				t.Fatalf("re-unmarshal: %v", err)
			}
			if len(again.ExcludeVirtualKeys) != 1 || again.ExcludeVirtualKeys[0] != "vk-sweep" {
				t.Fatalf("stored ExcludeVirtualKeys = %v, want [vk-sweep]", again.ExcludeVirtualKeys)
			}
			if r := cfg.Redacted(); len(r.ExcludeVirtualKeys) != 1 {
				t.Fatalf("redacted dropped ExcludeVirtualKeys: %v", r.ExcludeVirtualKeys)
			}
		})
	}
}
