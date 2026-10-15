"""Keep the installed sidebar entry point and the standalone preorder bootstrap in sync."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=root/'public/link-sidebar.js'
s=p.read_text()
start='/* LINK_PREORDER_BOOTSTRAP_START */\n'
end='/* LINK_PREORDER_BOOTSTRAP_END */\n'
if s.startswith(start):
    s=s.split(end,1)[1]
bootstrap=(root/'public/preorder-bootstrap.js').read_text()
p.write_text(start+bootstrap+end+s)
