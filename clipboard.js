/*!
 * Clipboard
 * Wrapper for Clipboard API and ZeroClipboard
 * Copyright (c) 2015 Alex Hyrenko
 * Licensed MIT
 * https://github.com/Satanpit/clipboard
 * v1.0
 */
(function (scope, doc) {
    'use strict';

    var copyInput, isNativeSupport, isFlashSupport,
        timeout, args, events = [ ];

    /**
     * Clipboard global config
     *
     * @type {{ZeroClipboard: (*|Function|ZeroClipboard|null)}}
     * @private
     */
    var globalConfig = {
        ZeroClipboard: (window.ZeroClipboard || null)
    };

    /**
     * Convert array like object to array
     *
     * @param {Object|HTMLCollection} arrayLike
     * @param {Number} [begin]
     * @param {Number} [end]
     * @returns {Array.<T>}
     * @private
     */
    function toArray(arrayLike, begin, end) {
        return [ ].slice.call(arrayLike, begin, end);
    }

    /**
     * Convert selector arguments to array
     *
     * @param {String|Array|HTMLElement|HTMLCollection} selector
     * @param {Document|HTMLElement} [context]
     * @returns {Array} elements array collection
     * @private
     */
    function toElements(selector, context) {
        var elements = [ ];

        context = context || document;

        if (Array.isArray(selector)) {
            return selector;
        }

        if (selector instanceof HTMLElement) {
            return [selector];
        }

        if (selector instanceof HTMLCollection) {
            elements = selector;
        }

        if (typeof selector === 'string') {
            elements = context.querySelectorAll(selector);
        }

        return toArray(elements || [ ]);
    }

    /**
     * Get target object properties,
     * set enumerable false for all target properties
     *
     * @param {Object} target
     * @returns {Object}
     * @private
     */
    function propertiesNames(target) {
        return Object.getOwnPropertyNames(target).reduce(function (result, key) {
            result[key] = Object.getOwnPropertyDescriptor(target, key);
            result[key].enumerable = false;

            return result;
        }, { })
    }

    /**
     * Define properties in target object
     *
     * @param {Object} target|properties
     * @param {Object} [properties]
     * @returns {Object}
     * @private
     */
    function defineProperties(target, properties) {
        if (!properties) {
            properties = target;
            target = { }
        }

        return Object.defineProperties(target, propertiesNames(properties));
    }

    /**
     * Clipboard event emitter
     *
     * @type {Object}
     * @private
     */
    var ClipboardEmitter = defineProperties({
        constructor: function ClipboardEmitter() { },

        /**
         * Channels storage
         */
        channels: {},

        /**
         * Subscribe on clipboard events
         *
         * @param {String} name
         * @param {Function} callback
         * @param {Object} [context]
         * @returns {ClipboardEmitter}
         */
        on: function (name, callback, context) {
            if (!this.channels[name]) {
                this.channels[name] = [ ];
            }

            this.channels[name].push({
                context: context || null,
                handler: callback
            });

            return this;
        },

        /**
         * Unsubscribe on clipboard event
         *
         * @param {String} [name]
         * @param {Function} [callback]
         * @returns {ClipboardEmitter}
         */
        off: function (name, callback) {
            if (arguments.length === 0) {
                this.channels.length = 0;
                return this;
            }

            if (!this.channels[name]) {
                return this;
            }

            if (callback && typeof callback === 'function') {
                this.channels[name].forEach(function (chanel, index) {
                    if (chanel.handler === callback) {
                        this.channels[name].splice(index, 1);
                    }
                }.bind(this));
            } else {
                delete this.channels[name];
            }

            return this;
        },

        /**
         * Triggered clipboard event
         *
         * @param {String} name
         * @param {Object} [properties]
         * @returns {ClipboardEmitter}
         */
        trigger: function (name, properties) {
            if (!this.channels[name]) {
                return this;
            }

            var args = toArray(arguments, 2);

            timeout && window.clearTimeout(timeout);
            timeout = window.setTimeout(function () {
                this.channels[name].forEach(function (chanel) {
                    args.unshift(new ClipboardCustomEvent(name, properties.target, properties));
                    chanel.handler.apply(chanel.context, args);
                });
            }.bind(this), 100);

            return this;
        }
    });

    /**
     * Clipboard event constructor
     *
     * @param {String} type
     * @param {HTMLElement|Object} target
     * @param {Object} properties
     * @constructor
     */
    var ClipboardCustomEvent = function (type, target, properties) {
        properties = properties || { };

        var defaultProperties = {
            type: type,
            target: target || null,
            clipboardType: properties.clipboardType || this.clipboardType,
            timeStamp: this.timeStamp
        };

        switch (type) {
            case 'copy':
                defaultProperties.text = properties.text || null;
                break;
            case 'error':
                defaultProperties.message = properties.message || null;
                defaultProperties.name = properties.name || null;
                break;
        }

        defineProperties(this, defaultProperties);
    };

    defineProperties(ClipboardCustomEvent.prototype, {
        get timeStamp() {
            return Date.now();
        },

        get clipboardType() {
            return (isNativeSupport ? 'native' : 'flash');
        },

        get isNativeSupported() {
            return isNativeSupport;
        },

        get isFlashSupported() {
            return isFlashSupport;
        }
    });

    /**
     * Get text value in copy callback
     *
     * @param {String|Function|Object|Array} callback
     * @param {ClipboardCustomEvent} event
     * @returns {String} text value
     * @private
     */
    var toString = function (callback, event) {
        if (typeof callback === 'function') {
            return callback(event);
        }

        if (typeof callback === 'object') {
            return JSON.stringify(callback);
        }

        return ('' + callback);
    };

    /**
     * Remove mouseDown event listeners
     * @private
     */
    var unbindMouseDown = function () {
        events.forEach(function (item) {
            item.elem.removeEventListener('mousedown', item.handler, false)
        });

        events.length = 0;
    };

    /**
     * Check execCommand copy function
     *
     * @returns {Boolean} is supported
     */
    var checkNativeClipboard = function () {
        return (isNativeSupport === undefined ? isNativeSupport = doc.queryCommandSupported('copy') : isNativeSupport);
    };

    /**
     * Create and append to document fake
     * textarea element for native clipboard
     *
     * @returns {Node} textarea
     */
    var copyElement = function () {
        if (copyInput instanceof HTMLTextAreaElement) {
            return copyInput;
        }

        copyInput = document.createElement('textarea');
        copyInput.style.position = 'absolute';
        copyInput.style.left = '-10000px';

        return (doc.body || doc.documentElement).appendChild(copyInput);
    };

    /**
     * Copy function
     * use ZeroClipboard library
     *
     * @param {String|Array|HTMLElement|HTMLCollection} elem
     * @param {*} callback
     * @private
     */
    var copyByZeroClipboard = function (elem, callback) {
        if (!globalConfig.ZeroClipboard) {
            isFlashSupport = false;
            return false;
        }

        isFlashSupport = true;

        var clip = new globalConfig.ZeroClipboard(elem),
            val;

        clip.on('copy', function (e) {
            val = toString(callback, new ClipboardCustomEvent('copy', e.target));
            e.clipboardData.setData('text/plain', val);

            this.trigger('copy', {
                clipboardType: 'flash',
                target: e.target,
                text: val
            });
        }.bind(this));

        clip.on('error', function (err) {
            if (err.name === 'flash-disabled') {
                isFlashSupport = false;
            }

            this.trigger('error', {
                clipboardType: 'flash',
                callback: callback,
                message: err.message,
                name: err.name
            });
        }.bind(this));
    };

    /**
     * Copy function
     * use native execCommand method
     *
     * @param {String|Array|HTMLElement|HTMLCollection} elem
     * @param {*} callback
     * @private
     */
    var copyByNativeClipboard = function (elem, callback) {
        var mouseDownHandler = function (e) {
            e.preventDefault();

            var val = toString(callback, new ClipboardCustomEvent('copy', e.target));

            copyElement().value = val;
            copyElement().select();

            try {
                doc.execCommand('copy');

                this.trigger('copy', {
                    target: e.target,
                    text: val
                });
            } catch (err) {
                isNativeSupport = false;
            }

            if (isNativeSupport === undefined) {
                checkNativeClipboard();
            }

            if (!isNativeSupport) {
                this.trigger('error', {
                    clipboardType: 'native',
                    callback: callback,
                    message: 'Native clipboard not supported',
                    name: 'copy-disabled'
                });

                if (isFlashSupport) {
                    unbindMouseDown();
                }
            }
        }.bind(this);

        elem.forEach(function (item) {
            item.addEventListener('mousedown', mouseDownHandler, false);

            events.push({
                elem: item,
                handler: mouseDownHandler
            });
        })
    };

    /**
     * External interface Clipboard lib
     *
     * @type {{copy: Function, config: Function, destroy: Function}}
     */
    var ClipboardAPI = {

        /**
         * Set callback text to buffer on click
         *
         * @param {String|Array|HTMLElement|HTMLCollection} elem
         * @param {*} callback
         * @returns {ClipboardAPI}
         */
        copy: function (elem, callback) {
            if (!elem || !callback) {
                throw new Error('Invalid arguments');
            }

            args = toArray(arguments);
            args.splice(0, 1, toElements(elem));

            if (isNativeSupport === undefined) {
                copyByZeroClipboard.apply(this, args);
                copyByNativeClipboard.apply(this, args);

                return this;
            }

            if (isNativeSupport) {
                copyByNativeClipboard.apply(this, args);
            } else {
                copyByZeroClipboard.apply(this, args);
            }

            return this;
        },

        /**
         * Set global config
         *
         * @param {Object} options
         * @returns {ClipboardAPI}
         */
        config: function (options) {
            Object.keys(options || { }).forEach(function (key) {
                globalConfig[key] = options[key];
            });

            return this;
        },

        /**
         * Unbind all events, removed cached data and fake element
         * Triggered 'destroy' event
         */
        destroy: function () {
            this.trigger('destroy');
            (doc.body || doc.documentElement).removeChild(copyInput);
            unbindMouseDown();
            globalConfig.ZeroClipboard.destroy();
            this.off();
        }
    };

    scope.Clipboard = Object.create(ClipboardEmitter, propertiesNames(ClipboardAPI));

}(window, document));