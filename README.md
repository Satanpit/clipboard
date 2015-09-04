# Сlipboard
Wrapper for Clipboard API and [ZeroClipboard](https://github.com/zeroclipboard/zeroclipboard) as alternative.

Using execCommand in supported browsers, ZeroClipboard library for other

#### Native driver support:

* IE10+
* Chrome 43+,
* Opera 29+

#### ZeroClipboard driver support:
See [ZeroClipboard](https://github.com/zeroclipboard/zeroclipboard)

### Usage

Copy target value on click:
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


Binding events:
```javascript
Clipboard.on('copy', console.log.bind(console));
Clipboard.on('error', console.error.bind(console));
```


Custom drivers usage:
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
Set global options

```js
Clipboard.config({
  baseDriver: 'native',
  ZeroClipboard: window.ZeroClipboard
});
```

===

#### `Clipboard.copy(target, callback)`
Copy `value` on click for `target`

* `target` - selector or HTML element or HTML collection or elements array (jQuery result object)
* `callback` - string or result function copy text (callback always converted to string)

If usin callback function, first argument is a ClipboardCustomEvent object

Triggered `copy` event if text copied to buffer or `error` even if copy problem

===

#### `Clipboard.destroy()`
Unbind all events, removed cached data and fake element
Triggered `destroy` event

===

#### `Clipboard.Driver`
Clipboard driver interface.

Use `Clipboard.Driver` for define custom clipboard interface.

##### Static methods:

`Driver.using` - Current used driver name
`Driver.current` - Get current used driver interface
`Driver.used(name)` - Set using driver
`Driver.has(name)` - Has driver in storage
`Driver.get(name)` - Get driver interface by name
`Drive.register(driver: ClipboardDriver)` - Add new driver to driver storage
`Driver.remove(name)` - Remove clipboard driver

##### Constructor:
`new Clipboard.Driver(name, driver)` - Created and register new driver.

* `name` - Driver name
* `drive` - ClipboardDriver object
    * `drive.checkSupport` Validate driver support function
    * `driver.copy` - Copy function
    * `driver.destroy` - Destroy driver function
    * `driver.config` - Set properties to global config

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
or subscribe on once event:

```js
Clipboard.one('copy', function(e) {
    console.log(e);
});
```

Arguments:

* `name` - event name
* `callback` - callback function
* `context` - callback context

Unsubscribe on clipboard events:

```js
Clipboard.off('copy', myCallback);
```

Triggered new event:

```js
Clipboard.trigger('customEvent', {
    target: document.body
});
```

#### Clipboard event constructor

Interface:

* `e.target` - targeting object
* `e.clipboardType` - target driver name
* `e.text` - copy text (only copy type events)
* `e.name` - error name (only error type events)
* `e.message` - error message (only error type events)
* `e.timeStamp` timestamp
