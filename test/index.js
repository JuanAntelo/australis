'use strict'

const tape = require('tape')
const tools = require('../tools')
const normalize = require('..').normalize
const generateSheet = require('..').generateSheet
const repr = JSON.stringify


tape('Basic mixing works', t => {
    const res = tools.mix({a: 1, b: 1, c: 1}, {b: 2}, {c: 3})
    t.deepEqual(res, {a: 1, b: 2, c: 3})
    t.end()
})


tape('Falsy values are ignored while mixing', t => {
    const res = tools.mix({a: 2}, false, {b: 3}, null, undefined)
    const expected = {a: 2, b: 3}

    t.deepEqual(res, expected)
    t.end()
})


tape('Normalizing simple style', t => {
    const input = {
        selector: {
            minWidth: '34px',
            borderWidth: '10px',
            backgroundColor: '#cccccc'
        }
    }

    const expected = {
        selector: {
            'min-width': '34px',
            'border-width': '10px',
            'background-color': '#cccccc',
        }
    }

    t.deepEqual(normalize(input), expected)

    t.end()
})


tape('Normalizing nested style', t => {
    const input = {
        selector: {
            subSelector: {
                minWidth: '34px',
                borderWidth: '10px',
                backgroundColor: '#cccccc'
            }
        }
    }

    const expected = {
        'selector subSelector': {
            'min-width': '34px',
            'border-width': '10px',
            'background-color': '#cccccc',
        }
    }

    t.deepEqual(normalize(input), expected)

    t.end()
})


tape('Non-nested media queries are reorganized properly', t => {
    const res = normalize({
        div: {
            height: '50px',
            '@media screen': {
                width: '100px', 
                '.class': {
                    zIndex: 45,
                }
            }
        }
    })

    const expected = {
        '@media screen': {
            div: {
                width: '100px'
            },

            'div .class': {
                'z-index': 45,
            }
        },

        div: {
            height: '50px',
        },
    }
    t.deepEqual(res, expected)
    t.end()
})

tape('Non-nestable at-rules are identified properly', t => {
    const res = normalize({
        '@charset': 'utf-8',
        div: {
            width: '10px',
        }
    })

    const expected = {
        '@charset': 'utf-8',
        div: {
            width: '10px',
        }
    }

    t.deepEqual(res, expected)

    t.end()
})


tape('tools.changeLight', t => {
    const pairs = [
        [tools.changeLight('#3388cc', 1.25), '#40aaff'],
        [tools.changeLight('#40aaff', 0.8), '#3388cc'],
        [tools.changeLight('#999999', 100), '#ffffff'],
        [tools.changeLight('#999999', 0), '#000000'],
    ]

    for (let [res, exp] of pairs) {
        t.equal(res, exp)
    }

    t.end()
})

tape('prefixing', t => {
    let res = tools.prefix('borderRadius', 10)
    let expected = {
        'WebkitBorderRadius': 10,
        'MozBorderRadius': 10,
        'MsBorderRadius': 10,
        'OBorderRadius': 10,
    }

    t.deepEqual(res, expected)

    res = tools.prefix('borderRadius', 20, ['hey', 'ya'])
    expected = {
        'HeyBorderRadius': 20,
        'YaBorderRadius': 20,
    }

    t.deepEqual(res, expected)

    t.end()
})


tape('tools.multivalue: multiple values for one property', t => {
    const res = tools.multivalue('prop', [1, 2, 3, 'lol'])
    const exp = {
        'prop/*0*/': 1,
        'prop/*1*/': 2,
        'prop/*2*/': 3,
        'prop/*3*/': 'lol',
    }
    t.deepEqual(res, exp)
    t.end()
})


tape('@media queries nesting results in AND-ed elements', t => {
    const res = normalize({
        '@media screen': {
            '.class1': {
                fontSize: '10px',
                '@media (min-width: 500px)': {
                    color: 'red',
                },
            },
        },
    })

    const expected = {
        '@media screen': {
            '.class1': {
                'font-size': '10px',
            },
        },

        '@media screen and (min-width: 500px)': {
            '.class1': {
                color: 'red',
            },
        },
    }

    t.deepEqual(res, expected)
    t.end()
})

tape('Regular/flat at-rules like @import @charset or @namespace work fine', t => {
    let res = normalize({'@charset': '"utf-8"'})
    let expected = {'@charset': '"utf-8"'}
    t.deepEqual(res, expected)

    res = generateSheet({'@charset': '"utf-8"'}).trim()
    expected = '@charset "utf-8";'
    t.equal(res, expected)

    // TODO: make imports go before anything
    res = generateSheet({'@import': '"some.css"'}).trim()
    expected = '@import "some.css";'
    t.equal(res, expected)

    res = generateSheet({'@namespace': 'svg url(http://www.w3.org/2000/svg)'}).trim()
    expected = '@namespace svg url(http://www.w3.org/2000/svg);'
    t.equal(res, expected)

    t.end()
})

/**
 * Small helper to remove any whitespaces, tabs or breaklines so that string comparisons
 * are easier and more reliable
 */
function normalizeString(str) {
    return str.replace(/\s/g, '')
}

tape('font-face at-rule works', t => {
    let res = generateSheet({
        '@font-face': {
            fontFamily: '"Bitstream Vera Serif Bold"',
            src: 'url("https://mdn.mozillademos.org/files/2468/VeraSeBd.ttf")'
        }
    })

    let expected = `
        @font-face {
          font-family: "Bitstream Vera Serif Bold";
          src: url("https://mdn.mozillademos.org/files/2468/VeraSeBd.ttf");
        }
    `
    t.equal(normalizeString(res), normalizeString(expected))
    t.end()
})

tape('page at-rule', t => {
    const res = generateSheet({
        '@page': {
            margin: '2px',
        },
        // TODO: consider if we want to allow @page nesting
        '@page :first': {
            marginTop: '10px',
        }
    })

    const exp = `
        @page { 
            margin: 2px;
        }

        @page :first {
          margin-top: 10px;
        }
    `
    t.equal(normalizeString(res), normalizeString(exp))
    t.end()
})
