export class Router {
	/**
	 * @type {import('express').IRouter}
	 */
	#router_;

	/**
	 * @type {Array<import('express').Handler>}
	 */
	#middlewareStack_;

	/**
	 * @param {import('express').IRouter} router
	 */
	constructor(router) {
		this.#router_ = router;
		this.#middlewareStack_ = [];
	}

	/**
	 * @param {Array<import('express').Handler>} handlers
	 */
	#applyMiddleware(...handlers) {
		return [...this.#middlewareStack_, ...handlers];
	}

	/**
	 * @param {string} path
	 * @param {Array<import('express').Handler>} handlers
	 */
	get(path, ...handlers) {
		this.#router_.get(path, ...this.#applyMiddleware(...handlers));
	}

	/**
	 * @param {string} path
	 * @param {Array<import('express').Handler>} handlers
	 */
	post(path, ...handlers) {
		this.#router_.post(path, ...this.#applyMiddleware(...handlers));
	}

	/**
	 * @param {string} path
	 * @param {Array<import('express').Handler>} handlers
	 */
	put(path, ...handlers) {
		this.#router_.put(path, ...this.#applyMiddleware(...handlers));
	}

	/**
	 * @param {string} path
	 * @param {Array<import('express').Handler>} handlers
	 */
	delete(path, ...handlers) {
		this.#router_.delete(path, ...this.#applyMiddleware(...handlers));
	}

	/**
	 * @param {object} opts
	 * @param {Array<import('express').Handler>} opts.middleware
	 * @param {() => void} callback
	 */
	group({ middleware }, callback) {
		const stack = Array.isArray(middleware)
			? middleware
			: [middleware];
		this.#middlewareStack_.push(...stack);

		callback();

		this.#middlewareStack_.splice(
			this.#middlewareStack_.length - stack.length,
			stack.length,
		);
	}

	get router() {
		return this.#router_;
	}
}

