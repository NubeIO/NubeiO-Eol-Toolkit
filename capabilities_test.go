package main

import "testing"

func TestModelCapabilities(t *testing.T) {
	app := NewApp()

	// Force Office model
	app.SetModel(1)
	caps := app.GetCapabilities()
	if caps.Model != 1 || caps.VerticalVaneCount != 1 || caps.HorizontalVaneCount != 0 {
		t.Errorf("office model vane counts mismatch: %+v", caps)
	}

	// Force Horizontal model
	app.SetModel(2)
	caps = app.GetCapabilities()
	if caps.Model != 2 || caps.VerticalVaneCount != 1 || caps.HorizontalVaneCount != 1 {
		t.Errorf("horizontal model vane counts mismatch: %+v", caps)
	}
	if caps.HorizontalSteps == 0 {
		t.Errorf("expected horizontal steps > 0 for model 2")
	}

	// Force VRF model
	app.SetModel(3)
	caps = app.GetCapabilities()
	if caps.Model != 3 || caps.VerticalVaneCount != 4 || caps.HorizontalVaneCount != 0 {
		t.Errorf("vrf model vane count mismatch: %+v", caps)
	}
}

func TestPerVaneSetters(t *testing.T) {
	app := NewApp()
	app.SetModel(3) // VRF supports 4 vertical

	app.SetVerticalVanePosition(2, 5)
	// Should clamp to max steps (4)
	if app.protocol.VertVanePos[2] != 4 {
		t.Errorf("expected vertical vane 2 pos clamped to 4, got %d", app.protocol.VertVanePos[2])
	}
	app.SetVerticalVaneSwing(2, true)
	if !app.protocol.VertVaneSwing[2] {
		t.Errorf("expected vertical vane 2 swing true")
	}

	// Horizontal (not really used in VRF) should still store
	app.SetHorizontalVanePosition(1, 3)
	if app.protocol.HorizVanePos[1] != 3 {
		t.Errorf("expected horiz vane 1 pos=3 stored")
	}
}
