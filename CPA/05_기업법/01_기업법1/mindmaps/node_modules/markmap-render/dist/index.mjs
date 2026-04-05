import { urlBuilder, buildJSItem, persistCSS, persistJS } from "markmap-common";
const template = `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="ie=edge" />
<title>Markmap</title>
<style>
* {
  margin: 0;
  padding: 0;
}
html {
  font-family: ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji',
    'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
}
#mindmap {
  display: block;
  width: 100vw;
  height: 100vh;
}
.markmap-dark {
  background: #27272a;
  color: white;
}
</style>
<!--CSS-->
</head>
<body>
<svg id="mindmap"></svg>
<!--JS-->
</body>
</html>
`;
const baseJsPaths = [
  `d3@${"7.9.0"}/dist/d3.min.js`,
  `markmap-view@${"0.18.12"}/dist/browser/index.js`
];
function fillTemplate(root, assets, extra) {
  extra = {
    ...extra
  };
  const urlBuilder$1 = extra.urlBuilder ?? urlBuilder;
  extra.baseJs ?? (extra.baseJs = baseJsPaths.map((path) => urlBuilder$1.getFullUrl(path)).map((path) => buildJSItem(path)));
  const { scripts, styles } = assets;
  const cssList = [...styles ? persistCSS(styles) : []];
  const context = {
    getMarkmap: () => window.markmap,
    getOptions: extra.getOptions,
    jsonOptions: extra.jsonOptions,
    root
  };
  const jsList = [
    ...persistJS(
      [
        ...extra.baseJs,
        ...scripts || [],
        {
          type: "iife",
          data: {
            fn: (getMarkmap, getOptions, root2, jsonOptions) => {
              const markmap = getMarkmap();
              window.mm = markmap.Markmap.create(
                "svg#mindmap",
                (getOptions || markmap.deriveOptions)(jsonOptions),
                root2
              );
              if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
                document.documentElement.classList.add("markmap-dark");
              }
            },
            getParams: ({ getMarkmap, getOptions, root: root2, jsonOptions }) => {
              return [getMarkmap, getOptions, root2, jsonOptions];
            }
          }
        }
      ],
      context
    )
  ];
  const html = template.replace("<!--CSS-->", () => cssList.join("")).replace("<!--JS-->", () => jsList.join(""));
  return html;
}
export {
  baseJsPaths,
  fillTemplate,
  template
};
