const RENDER_TO_DOM = Symbol("render to dom");

export class Component {
    constructor() {
        this.props = Object.create(null);
        this.children = [];
        this._root = null;
        this._range = null;
    }
    setAttribute(name, value) {
        this.props[name] = value;
    }
    appendChild(component) {
        this.children.push(component);
    }
    get vdom() {
        return this.render().vdom;
    }
    // get vchildren() {
    //     return this.children.map(child => child.vdom);
    // }
    [RENDER_TO_DOM](range) {
        this._range = range;
        this._vdom = this.vdom;
        // this.render()[RENDER_TO_DOM](range);
        this._vdom[RENDER_TO_DOM](range);
    }
    update() {
        let isSameNode = (oldNode, newNode) => {
            if (oldNode.type !== newNode.type)
                return false
            for (let name in newNode.props) {
                if (newNode.props[name] !== oldNode.props[name])
                    return false;
            }
            if (Object.keys(oldNode.props).length > Object.keys(newNode.props).length)
                return false;

            if (newNode.type === "#text" && newNode.content !== oldNode.content)
                return false;

            return true;
        }

        let update = (oldNode, newNodw) => {
            if (!isSameNode(oldNode, newNodw)) {    // 完全替换
                newNodw[RENDER_TO_DOM](oldNode._range);
                return;
            }
            newNodw._range = oldNode._range;

            let newChildren = newNodw.vchildren;
            let oldChildren = oldNode.vchildren;

            if (!newChildren || !newChildren.length)
                return;

            let tailRange = oldChildren[oldChildren.length - 1]._range;

            for (let i = 0; i < newChildren.length; i++) {
                let newChild = newChildren[i];
                if (i < oldChildren.length) {
                    let oldChild = oldChildren[i];
                    update(oldChild, newChild);
                } else {
                    let range = document.createRange();
                    range.setStart(tailRange.endContainer, tailRange.endOffset);
                    range.setEnd(tailRange.endContainer, tailRange.endOffset);
                    newChild[RENDER_TO_DOM](range);
                    tailRange = range;
                    // TODO
                }
            }
        }

        let vdom = this.vdom;
        update(this._vdom, vdom);
        this._vdom = vdom;
    }
    // rerender() {
    //     // 原逻辑如注释代码所示，下面的代码为解决 Range bug 插入
    //     // this._range.deleteContents();
    //     // this[RENDER_TO_DOM](this._range);

    //     let oldRange = this._range;
    //     let range = document.createRange();
    //     range.setStart(oldRange.startContainer, oldRange.startOffset);
    //     range.setEnd(oldRange.startContainer, oldRange.startOffset);
    //     this[RENDER_TO_DOM](range);

    //     oldRange.setStart(range.endContainer, range.endOffset);
    //     oldRange.deleteContents();
    // }
    setState(newState) {
        if (this.state === null || typeof this.state !== "object") {
            this.state = newState;
            this.rerender();
        }

        let merge = (oldState, newState) => {
            for (let p in newState) {
                if (oldState[p] === null || typeof oldState[p] !== "object") {
                    oldState[p] = newState[p];
                } else {
                    merge(oldState[p], newState[p]);
                }
            }
        }
        merge(this.state, newState);
        this.update();
    }
}

class ElementWrapper extends Component {
    constructor(type) {
        super(type);
        this.type = type;
        // this.root = document.createElement(type); // 在 RENDER_TO_DOM 中延迟生成
    }
    get vdom() {
        this.vchildren = this.children.map(child => child.vdom);
        return this;
    }
    [RENDER_TO_DOM](range) {
        this._range = range;
        // range.deleteContents();

        let root = document.createElement(this.type);

        for (let name in this.props) {
            let value = this.props[name];
            if (name.match(/^on([\s\S]+)/)) {
                root.addEventListener(
                    RegExp.$1.replace(/^[\s\S]/, c => c.toLowerCase()), // 确保事件名小写
                    value);
            } else {
                if (name === "className") {
                    root.setAttribute("class", value);
                }
                else {
                    root.setAttribute(name, value);
                }
            }
        }

        if (this.vchildren)
            this.vchildren = this.children.map(child => child.vdom);

        for (let child of this.vchildren) {
            let childRange = document.createRange();
            childRange.setStart(root, root.childNodes.length);
            childRange.setEnd(root, root.childNodes.length);
            child[RENDER_TO_DOM](childRange);
        }

        replaceContent(range, root);
        // range.insertNode(root);
    }
}

class TextWrapper extends Component {
    constructor(content) {
        super(content);
        this.type = "#text";
        this.content = content;
        // this.root = document.createTextNode(content);
    }
    get vdom() {
        return this;
    }
    [RENDER_TO_DOM](range) {
        this._range = range;
        // range.deleteContents();
        // range.insertNode(this.root);
        let root = document.createTextNode(this.content);
        replaceContent(range, root);
    }
}

function replaceContent(range, node) {
    range.insertNode(node);
    range.setStartAfter(node);
    range.deleteContents();

    range.setStartBefore(node);
    range.setEndAfter(node);
}

export function zion(type, attributes, ...children) {
    let e;
    if (typeof type === "string") {
        e = new ElementWrapper(type);
    } else {
        e = new type;
    }
    for (let p in attributes) {
        e.setAttribute(p, attributes[p]);
    }
    let insertChildren = (children) => {
        for (let child of children) {
            if (typeof child === "string") {
                child = new TextWrapper(child);
            }
            if (child === null) {
                continue;
            }
            if (typeof child === "object" && child instanceof Array) {
                insertChildren(child);
            } else {
                e.appendChild(child);
            }
        }
    }

    insertChildren(children);

    return e;
}

export function render(component, parentElement) {
    let range = document.createRange();
    range.setStart(parentElement, 0);
    range.setEnd(parentElement, parentElement.childNodes.length);
    range.deleteContents();
    component[RENDER_TO_DOM](range);
}