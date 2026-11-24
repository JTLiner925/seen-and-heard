# Inlines the land data and the shared core into the viewer, so it is one self-contained file
# (the algorithmic-art skill's rule) while the site loads the same two files.
import pathlib
d = pathlib.Path(__file__).parent
src = (d / 'viewer.src.html').read_text()
out = src.replace('/*LAND*/', (d / 'land.js').read_text()).replace('/*CORE*/', (d / 'mustard-seed.js').read_text())
(d / 'viewer.html').write_text(out)
print('wrote', d / 'viewer.html', len(out), 'bytes')
