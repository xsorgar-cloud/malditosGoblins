const fs = require('fs');
let css = fs.readFileSync('css/style.css', 'utf8');

css = css.replace(
    '  #role-selection-container > div {\r\n    flex-direction: column !important;\r\n    align-items: center !important;\r\n    gap: 12px !important;\r\n    padding: 12px 5px !important;\r\n    width: 100% !important;\r\n    box-sizing: border-box !important;\r\n  }',
    '  #role-selection-container > div {\r\n    flex-direction: column !important;\r\n    align-items: center !important;\r\n    gap: 12px !important;\r\n    padding: 12px 5px !important;\r\n    width: 100% !important;\r\n    box-sizing: border-box !important;\r\n    position: relative !important;\r\n  }'
);

css = css.replace(
    '  #role-selection-container > div > div:nth-child(2) {\r\n    flex-direction: row !important;\r\n    flex-wrap: nowrap !important;\r\n    justify-content: center !important;\r\n    gap: 5px !important;\r\n    width: 100% !important;\r\n  }',
    '  #role-selection-container > div > div:nth-child(2) {\r\n    flex-direction: row !important;\r\n    flex-wrap: nowrap !important;\r\n    justify-content: center !important;\r\n    gap: 2px !important;\r\n    width: 100% !important;\r\n  }'
);

css = css.replace(
    '  .role-option {\r\n    width: 42px !important;\r\n    height: 42px !important;\r\n    min-width: 42px !important;\r\n    background-size: contain !important;\r\n  }',
    '  .role-option {\r\n    width: 52px !important;\r\n    height: 52px !important;\r\n    min-width: 52px !important;\r\n    background-size: contain !important;\r\n  }'
);

css = css.replace(
    '  .role-option[title=\x22Rol Aleatorio\x22] {\r\n    border-radius: 50% !important;\r\n  }',
    '  .role-option[title=\x22Rol Aleatorio\x22] {\r\n    position: absolute !important;\r\n    top: 10px !important;\r\n    right: 15px !important;\r\n    width: 30px !important;\r\n    height: 30px !important;\r\n    min-width: 30px !important;\r\n    border-radius: 8px !important;\r\n    font-size: 1rem !important;\r\n  }'
);

css = css.replace(
    '  .role-option-toast {\r\n    left: 2px;\r\n    right: 2px;\r\n    height: 18px;\r\n    top: calc(50% - 9px);',
    '  .role-option-toast {\r\n    left: -15px;\r\n    right: -15px;\r\n    overflow: visible !important;\r\n    height: 18px;\r\n    top: calc(50% - 9px);'
);

fs.writeFileSync('css/style.css', css);
console.log('CSS modified successfully');