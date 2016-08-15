/* global React, ReactDOM */

module.exports = {
  react: {
    imports: {
      dom: [
        ['React', 'react'],
        ['ReactDOM', 'react-dom']
      ],
      string: [
        ['React', 'react'],
        ['ReactDOM', 'react-dom/server']
      ]
    },
    dom: C => (props, el) => ReactDOM.render(React.createElement(C, props), el),
    string: C =>
      props =>
        ReactDOM.renderToStaticMarkup(React.createElement(C, props))
  }
}
