const fs = require('fs');
let css = fs.readFileSync('css/style.css', 'utf8');

css = css.replace(
  /#combat-goblins-container .goblin-card {[\s\S]*?max-height: 127px !important;\s*aspect-ratio: 180 \/ 255 !important;\s*}/g,
  #combat-goblins-container .goblin-card {
    flex: 0 0 clamp(90px, 14vw, 160px) !important;
    width: clamp(90px, 14vw, 160px) !important;
    min-width: clamp(90px, 14vw, 160px) !important;
    max-width: clamp(90px, 14vw, 160px) !important;
    height: calc(clamp(90px, 14vw, 160px) * 255 / 180) !important;
    max-height: calc(clamp(90px, 14vw, 160px) * 255 / 180) !important;
    aspect-ratio: 180 / 255 !important;
  }
);

css = css.replace(
  /\.combat-equipment \.equip-slot {[\s\S]*?max-height: 111px !important;\s*}/g,
  .combat-equipment .equip-slot {
    flex: 0 0 clamp(75px, 11vw, 130px) !important;
    width: clamp(75px, 11vw, 130px) !important;
    min-width: clamp(75px, 11vw, 130px) !important;
    max-width: clamp(75px, 11vw, 130px) !important;
    height: calc(clamp(75px, 11vw, 130px) * 255 / 180) !important;
    max-height: calc(clamp(75px, 11vw, 130px) * 255 / 180) !important;
  }
);

fs.writeFileSync('css/style.css', css, 'utf8');
