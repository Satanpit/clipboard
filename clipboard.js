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

    var timeout, args;

    /**
     * Clipboard global config
     *
     * @type {Object}
     * @prop {*|Function|ZeroClipboard} [ZeroClipboard] ZeroClipboard library constructor
     * @prop {String} baseDriver default driver name
     * @prop {String} alternativeDriver alternative driver name, init on starting, destroyed if base driver supported
     * @private
     */
    var globalConfig = {
        baseDriver: 'native',
        alternativeDriver: 'flash'
    };

    /**
     * Required driver methods
     * for validation in driver constructor
     *
     * @type {string[]}
     * @private
     */
    var requiredDriverMethods = [
        'checkSupport',
        'copy',
        'destroy'
    ];

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

        return toArray(elements.length ? elements : selector);
    }

    /**
     * Get target object properties,
     * set enumerable false for all target properties
     *
     * @param {Object} target
     * @param {Boolean} [enumerable]
     * @returns {Object}
     * @private
     */
    function propertiesNames(target, enumerable) {
        return Object.getOwnPropertyNames(target).reduce(function (result, key) {
            result[key] = Object.getOwnPropertyDescriptor(target, key);
            result[key].enumerable = enumerable || false;

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
        channels: { },

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
         * Subscribe once on clipboard events
         *
         * @param {String} name
         * @param {Function} callback
         * @param {Object} [context]
         * @returns {ClipboardEmitter}
         */
        one: function (name, callback, context) {
            var onceCallback = function () {
                ClipboardEmitter.off(name, onceCallback);
                callback.apply(context, arguments);
            };

            return this.on(name, onceCallback);
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
                args.unshift(new ClipboardCustomEvent(name, properties));

                this.channels[name].forEach(function (chanel) {
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
     * @param {Object} [properties]
     * @param {Object} [properties.target] targeting object
     * @param {Object} [properties.clipboardType] clipboard type, native or flash
     * @param {Object} [properties.text] copy text (only copy type events)
     * @param {Object} [properties.name] error name (only error type events)
     * @param {Object} [properties.message] error message (only error type events)
     * @constructor
     */
    var ClipboardCustomEvent = function (type, properties) {
        properties = properties || { };

        var defaultProperties = {
            type: type,
            target: properties.target || null,
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
            return ClipboardDriver.using;
        }
    });

    /**
     * Clipboard base method for drivers
     *
     * @type {ClipboardEmitter}
     */
    var ClipboardBase = Object.create(ClipboardEmitter, propertiesNames({
        constructor: function ClipboardBase() { },

        /**
         * Convert callback copy argument to string
         *
         * @param {*} callback
         * @param {Object} [target] create ClipboardCustomEvent by called callback function
         * @returns {String}
         */
        callbackToString: function (callback, target) {
            if (typeof callback === 'function') {
                return callback( new ClipboardCustomEvent('copy', { target: target }) );
            }

            if (typeof callback === 'object') {
                return JSON.stringify(callback);
            }

            return '' + callback;
        }
    }));

    /**
     * Clipboard driver interface
     *
     * @param {String} name
     * @param {ClipboardBase} driver
     * @param {Function} driver.checkSupport validate driver support
     * @param {Function} driver.copy
     * @param {Function} driver.destroy
     * @param {Object} [driver.config] set properties to global config
     * @constructor
     */
    var ClipboardDriver = function (name, driver) {
        this.name = name;

        driver = Object.create(ClipboardBase, propertiesNames(driver, true));

        try {
            var scope = driver;

            requiredDriverMethods.forEach(function (key) {
                if (!driver.hasOwnProperty(key)) {
                    throw Error('Method '+ key +' is not defined');
                }
            });

            Object.keys(driver).forEach(function (key) {
                if (key in this) {
                    this[key] = typeof driver[key] === 'function' ? driver[key].bind(scope) : driver[key];
                }
            }, this);

            ClipboardDriver.register(this);
        } catch(err) {
            driver.trigger('error', {
                target: driver,
                name: 'driver-error',
                message: err
            });
        }
    };

    /**
     * Clipboard driver static methods
     */
    defineProperties(ClipboardDriver, {
        /**
         * Drivers storage
         */
        drivers: { },

        /**
         * Current used driver name
         */
        using: undefined,

        /**
         * Get current used driver interface
         *
         * @returns {ClipboardDriver}
         */
        get current() {
            return this.drivers[this.using];
        },

        /**
         * Set using driver
         *
         * @param {String} name driver name
         * @returns {ClipboardDriver}
         */
        use: function (name) {
            if (this.has(name)) {
                this.using = name
            }

            return this;
        },

        /**
         * Has driver in storage
         *
         * @param {String} name driver name
         * @returns {boolean}
         */
        has: function (name) {
            return Boolean(this.drivers[name]);
        },

        /**
         * Get driver interface by name
         *
         * @param {String} name driver name
         * @returns {ClipboardDriver}
         */
        get: function (name) {
            if (this.has(name)) {
                return this.drivers[name];
            }
        },

        /**
         * Register new clipboard driver
         *
         * @param {ClipboardDriver} driver
         * @returns {ClipboardDriver}
         */
        register: function (driver) {
            if (!(driver instanceof ClipboardDriver)) {
                throw Error('Driver instance is not ClipboardDriver');
            }

            if (this.has(driver.name)) {
                throw Error('Driver "'+ driver.name +'" already exists');
            }

            if (driver.config) {
                Object.keys(driver.config).forEach(function (key) {
                    globalConfig[key] = driver.config[key];
                });
            }

            this.drivers[driver.name] = driver;

            return this;
        },

        /**
         * Remove clipboard driver
         *
         * @param {String} name
         * @returns {ClipboardDriver}
         */
        remove: function (name) {
            if (this.has(name)) {
                this.get(name).destroy();
                delete this.drivers[name];
            }

            return this;
        }
    });

    /**
     * Clipboard driver validation interface
     */
    defineProperties(ClipboardDriver.prototype, {
        set name(name) {
            if (typeof name !== 'string') {
                throw Error('name is not a string');
            }

            Object.defineProperty(this, 'name', { value: name });
        },

        set type(type) {
            if (typeof type !== 'string') {
                throw Error('type is not a string');
            }

            Object.defineProperty(this, 'type', { value: type });
        },

        set checkSupport(value) {
            if (typeof value !== 'function') {
                throw Error('checkSupport method is not a function');
            }

            Object.defineProperty(this, 'checkSupport', { value: value });
        },

        set copy(value) {
            if (typeof value !== 'function') {
                throw Error('copy method is not a function');
            }

            Object.defineProperty(this, 'copy', { value: value });
        },

        set destroy(value) {
            if (typeof value !== 'function') {
                throw Error('destroy method is not a function');
            }

            Object.defineProperty(this, 'destroy', { value: value });
        },

        set config(value) {
            if (typeof value !== 'object') {
                throw Error('config is not a object');
            }

            Object.defineProperty(this, 'config', { value: value });
        }
    });


    new ClipboardDriver('native', {
        isSupport: undefined,
        events: [ ],
        textArea: undefined,

        get copyElement() {
            if (this.textArea instanceof HTMLTextAreaElement) {
                return this.textArea;
            }

            this.textArea = doc.createElement('textarea');
            this.textArea.style.position = 'absolute';
            this.textArea.style.left = '-10000px';

            return (doc.body || doc.documentElement).appendChild(this.textArea);
        },

        checkSupport: function () {
            return this.isSupport === undefined ? this.isSupport = doc.queryCommandSupported('copy') : this.isSupport;
        },

        copy: function (elem, callback) {
            var mouseDownHandler = function (e) {
                e.preventDefault();

                var val = this.callbackToString(callback, e.target);

                this.copyElement.value = val;
                this.copyElement.select();

                try {
                    doc.execCommand('copy');

                    this.trigger('copy', {
                        target: e.target,
                        text: val
                    });
                } catch (err) {
                    this.isSupport = false;
                }

                if (this.isSupport === undefined) {
                    this.checkSupport();

                    if (this.isSupport) {
                        ClipboardDriver.remove('flash');
                    }
                }

                if (!this.isSupport) {
                    this.trigger('error', {
                        clipboardType: 'native',
                        target: e.target,
                        message: 'Native clipboard not supported',
                        name: 'support'
                    });
                } else {
                    ClipboardDriver.use('native');
                }
            }.bind(this);

            elem.forEach(function (item) {
                item.addEventListener('mousedown', mouseDownHandler, false);

                this.events.push({
                    elem: item,
                    handler: mouseDownHandler
                });
            }, this);

            return this;
        },

        destroy: function () {
            (doc.body || doc.documentElement).removeChild(this.copyElement);

            this.events.forEach(function (item) {
                item.elem.removeEventListener('mousedown', item.handler, false);
            });

            this.events.length = 0;
        }
    });

    new ClipboardDriver('flash', {
        config: {
            ZeroClipboard: window.ZeroClipboard || null
        },

        checkSupport: function () {
            if (!this.config.ZeroClipboard) {
                return false;
            }

            return !this.config.ZeroClipboard.isFlashUnusable();
        },

        copy: function (elem, callback) {
            var clip = new globalConfig.ZeroClipboard(elem),
                val;

            clip.on('copy', function (e) {
                val = this.callbackToString(callback, e.target);
                e.clipboardData.setData('text/plain', val);

                this.trigger('copy', {
                    clipboardType: 'flash',
                    target: e.target,
                    text: val
                });
            }.bind(this));

            clip.on('error', function (err) {
                this.trigger('error', {
                    clipboardType: 'flash',
                    callback: callback,
                    message: err.message,
                    name: err.name
                });
            }.bind(this));
        },

        destroy: function () {
            this.config.ZeroClipboard.destroy();
        }
    });

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

            if (ClipboardDriver.using === undefined) {
                ClipboardDriver.use(globalConfig.baseDriver);
                ClipboardDriver.current.copy.apply(ClipboardDriver.current, args);

                if (globalConfig.alternativeDriver && ClipboardDriver.has(globalConfig.alternativeDriver)) {
                    var alt = ClipboardDriver.get(globalConfig.alternativeDriver);

                    if (alt.checkSupport()) {
                        alt.copy.apply(alt, args);
                    } else {
                        ClipboardDriver.remove(alt.name);
                    }
                }
            } else {
                ClipboardDriver.current.copy.apply(ClipboardDriver.current, args);
            }

            this.on('error', function (e) {
                if (e.name === 'support') {
                    ClipboardDriver.remove(e.clipboardType);

                    Object.keys(ClipboardDriver.drivers).forEach(function (key) {
                        var driver = ClipboardDriver.get(key);

                        if (driver.checkSupport()) {
                            driver.copy.apply(driver, args);
                            ClipboardDriver.use(driver.name);

                            e.target.dispatchEvent(new MouseEvent('mousedown'));

                            return false;
                        }
                    });
                }
            }, this);

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
         * Clipboard drivers interface
         */
        Driver: ClipboardDriver,

        /**
         * Unbind all events, removed cached data and fake element
         * Triggered 'destroy' event
         */
        destroy: function () {
            this.trigger('destroy');

            Object.keys(ClipboardDriver.drivers).forEach(function (key) {
                var driver = ClipboardDriver.get(key);
                driver.destroy();
            });

            this.off();
        }
    };

    scope.Clipboard = Object.create(ClipboardEmitter, propertiesNames(ClipboardAPI));

}(window, document));