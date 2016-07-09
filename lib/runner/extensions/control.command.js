var _ = require('lodash'),
    util = require('../util');

module.exports = {
    /**
     * All the events that this extension triggers
     * @type {Array}
     */
    triggers: ['pause', 'resume', 'abort'],

    prototype: /** @lends Run.prototype */ {
        /**
         * Pause a run
         * @param {function} callback
         */
        pause: function (callback) {
            if (this.paused) { return util.safeCall(callback, this, new Error('run: already paused')); }

            // schedule the pause command as an interrupt and flag that the run is pausing
            this.paused = true;
            this.interrupt('pause', null, callback);
        },

        /**
         * Resume a paused a run
         * @param {function} callback
         */
        resume: function (callback) {
            if (!this.paused) { return util.safeCall(callback, this, new Error('run: not paused')); }

            // set flag that it is no longer paused and fire the stored callback for the command when it was paused
            this.paused = false;
            setTimeout(function () {
                this.__resume();
                this.triggers.resume(null, this.state.cursor.current());
            }.bind(this), 0);
            util.safeCall(callback, this);
        },

        /**
         * Aborts a run
         *
         * @param {boolean} [summarise=true]
         * @param {function} callback
         */
        abort: function (summarise, callback) {
            if (_.isFunction(summarise) && !callback) {
                callback = summarise;
                summarise = true;
            }

            this.interrupt('abort', {
                summarise: summarise
            }, callback);
        }
    },

    process: /** @lends Run.commands */ {
        pause: function (userback, payload, next) {
            // execute the userback sent as part of the command and do so in a try block to ensure it does not hamper
            // the process tick
            var error = util.safeCall(userback, this);

            // if there is an error executing the userback, then raise the error
            if (error) {
                return next(error);
            }

            // trigger the secondary callbacks
            this.triggers.pause(null, this.state.cursor.current());

            // tuck away the command completion callback in the run object so that it can be used during resume
            this.__resume = next;
        },

        /**
         * @param {Object} payload
         * @param {Boolean} payload.summarise
         * @param {Function} userback
         * @param {Function} next
         */
        abort: function (userback, payload, next) {
            // execute the userback sent as part of the command and do so in a try block to ensure it does not hamper
            // the process tick
            var error = util.safeCall(userback, this);

            // clear instruction pool and as such there will be nothing next to execute
            this.pool.clear();
            this.triggers.abort(null, this.state.cursor.current());

            // if there is an error executing the userback, then raise the error
            next(error || null);
        }
    }
};