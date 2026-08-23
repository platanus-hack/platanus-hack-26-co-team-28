OPENSCAD ?= openscad
SCAD := cad/woki_modulos.scad
PARTS := centro_bandeja pantalla_marco pantalla_pie centro_powerbank nodo_base nodo_tapa bateria_placa nodo_bandeja_ip68
STL_DIR := exports/stl
THREEMF_DIR := exports/3mf

.PHONY: all stl 3mf previews validate clean

all: stl 3mf

stl: $(PARTS:%=$(STL_DIR)/%.stl)

3mf: $(PARTS:%=$(THREEMF_DIR)/%.3mf)

$(STL_DIR)/%.stl: $(SCAD)
	@mkdir -p $(STL_DIR)
	$(OPENSCAD) --hardwarnings -o $@ -D 'part="$*"' $<

$(THREEMF_DIR)/%.3mf: $(SCAD)
	@mkdir -p $(THREEMF_DIR)
	$(OPENSCAD) --hardwarnings -o $@ -D 'part="$*"' $<

previews: $(PARTS:%=assets/%.png)

validate: stl
	python3 scripts/validate_stl.py $(PARTS:%=$(STL_DIR)/%.stl)

assets/%.png: $(SCAD)
	@mkdir -p assets
	$(OPENSCAD) -o $@ --imgsize=900,620 --autocenter --viewall --projection=p --render -D 'part="$*"' $<

clean:
	rm -rf exports assets
