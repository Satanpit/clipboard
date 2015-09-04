# Сlipboard
Wrapper for Clipboard API and [ZeroClipboard](https://github.com/zeroclipboard/zeroclipboard) as alternative.

Uses execCommand if supported otherwise fallback to ZeroClipboard library

#### Native driver support:

* IE10+
* Chrome 43+,
* Opera 29+

#### ZeroClipboard driver support:
See [ZeroClipboard](https://github.com/zeroclipboard/zeroclipboard)

### Usage

Copy target's value on click:
```javascript
document.addEventListener('DOMContentLoaded', function () {
    Clipboard.copy('.copy', function (e) {
        return e.target.value;
    });
})
```

Copy static text:
```javascript
Clipboard.copy('.copy', 'Hello, world!');
```


Handle events:
```javascript
Clipboard.on('copy', console.log.bind(console));
Clipboard.on('error', console.error.bind(console));
```


Define custom driver:
```javascript
new Clipboard.Driver('prompt', {
    checkSupport: function () {
        return true;
    },

    events: [ ],

    copy: function (elem, callback) {
        elem.forEach(function (item) {
            var handler = function (e) {
                window.prompt("Copy to clipboard: Ctrl+C, Enter", this.callbackToString(callback, e.target));
            }.bind(this);

            item.addEventListener('mousedown', handler, false);

            this.events.push({
                elem: item,
                handler: handler
            })
        }, this);
    },

    destroy: function () {
        this.events.forEach(function (item) {
            item.elem.removeEventListener('mousedown', item.handler, false);
        });

        this.events.length = 0;
    }
});
```

## Clipboard API

### Static methods:

#### `Clipboard.config(options)`
Configure

```js
Clipboard.config({
  baseDriver: 'native',
  ZeroClipboard: window.ZeroClipboard
});
```

===

#### `Clipboard.copy(target, callback)`
When fires a mousedown event on a `target`, will copy text from a `callback` to the copy buffer.

* `{String|Array|HTMLElement|HTMLCollection} `target` Selector or list of DOMElements to be listened
* `{String} callback` Static text for the copy buffer
* `{Function} callback` Retrieves text for the copy buffer

* `{ClipboardCustomEvent} callback.arguments[0]` Custom clipboard event

Triggers `copy` event, if text was copied. Otherwise triggers `error` event.

===

#### `Clipboard.destroy()`
Unbind all events, removes cached data and fake element
Triggers `destroy` event

===

#### `Clipboard.Driver`
Clipboard driver interface.

##### Static methods:
`Driver.using` Current driver name
`Driver.current()` Current driver
`Driver.use({String} name)` Use given driver
`Driver.has({String} name)` Is driver declared
`Driver.get({String} name)` Get driver by name
`Driver.register({ClipboardDriver} driver)` Declare new driver
`Driver.remove({String} name)` Remove driver

##### Constructor:
`new Clipboard.Driver(name, driver)` Creates and register new driver.
Use `Clipboard.Driver` to declare custom clipboard driver.

* `{String} name` Driver name
* `{Object} driver` Driver prototype
* `{Function} driver.checkSupport` Validates driver compatability
* `{Function} driver.copy` Copy function
* `{Function} driver.destroy` Destroys driver
* `{Object} driver.config` Set properties to global config

Example:

```js
new Clipboard.Driver('custom', {
    checkSupport: function () {
        //...
    },

    copy: function (elem, callback) {
        //...
    },
    
    destroy: function () {
        //...
    }
});
```

### Event emitter

Subscribe on clipboard events:
```js
Clipboard.on('copy', function(e) {
    console.log(e);
});
```

or subscribe on event once:
```js
Clipboard.one('copy', function(e) {
    console.log(e);
});
```

Arguments:

* `{String} name` Event name
* `{Function} callback` Callback function
* `{Object} [context]` Callback context

Unsubscribe from clipboard events:
```js
Clipboard.off('copy', myCallback);
```

Triggered new event:
```js
Clipboard.trigger('customEvent', {
    target: document.body
});
```

#### ClipboardCustomEvent constructor

Interface:

* `{DOMElement} e.target` Handled target element
* `{String} e.clipboardType` Handled driver's name
* `{String} e.text` Copied text (only for ``copy` event)
* `{String} e.name` Error name (only for `error` event)
* `{String} e.message` Error message (only for `error` event)
* `{Date} e.timeStamp` Timestamp
