import { render } from 'lit-html'
import {shallowReactive, effect} from '@vue/reactivity/dist/reactivity.esm-browser.js'

let currentInstance

export function defineComponent(name, propDefs /* 定义props，以数组形式 */, factory) {
  debugger;
  // 重载，根据参数类型进行不同处理
  if (typeof propDefs === 'function' /* propDefs可以是函数，如果是，则将其赋值给factory，相当于factory向前挪了 */) {
    factory = propDefs // 将propDefs 函数 赋值给factory
    propDefs = [] // 将props置为空数组
  }

  // web component
  const Component = class extends HTMLElement {
    // 获取已经观察过的props
    static get observedAttributes() {
      return propDefs
    }
    constructor() {
      super()
      // 将 _props 创建为响应式变量
      const props = (this._props = shallowReactive({}))
      // 而生命周期函数还有一个特点，即并不分组件实例，
      // 因此必须有一个 currentInstance 标记当前回调
      // 函数是在哪个组件实例注册的，而这个注册的同步过
      // 程就在 defineComponent 回调函数 factory 执行期间
      currentInstance = this
      const template = factory.call(this, props)
      currentInstance = null
      // 这样，我们就将 currentInstance 始终指向当前正在
      // 执行的组件实例，而所有生命周期函数都是在这个过程
      // 中执行的，因此当调用生命周期回调函数时，currentInstance 
      // 变量必定指向当前所在的组件实例。


      // 生命周期
      this._bm && this._bm.forEach((cb) => cb())
      // 在 attachShadow 执行之前执行 _bm - onBeforeMount，因为这个过程确实是准备组件挂载的最后一步。
      const root = this.attachShadow({ mode: 'closed' })
      let isMounted = false
      effect(() => {
        // 在 effect 中调用了两个生命周期，因为 
        // effect 会在每次渲染时执行，所以还特意
        // 存储了 isMounted 标记是否为初始化渲染：
        if (!isMounted) {
          // 生命周期 生命周期可以注册多次，所以是循环
          // 在渲染render前，且第一次渲染才会调用_bu - onBeforeUpdate
          this._bu && this._bu.forEach((cb) => cb())
        }
        // 在 effect 回调函数内调用 html 函数，
        // 即在使用文档里返回的模版函数，由于这
        // 个模版函数中使用的变量都采用 reactive 
        // 定义，所以 effect 可以精准捕获到其变化，
        // 并在其变化后重新调用 effect 回调函数，
        // 实现了 “值变化后重渲染” 的功能。
        render(template(), root) // lit-html
        // 由于 render(template(), root) 根据 lit-html 
        // 的语法，会直接把 template() 返回的 HTML 元素
        // 挂载到 root 节点，而 root 就是这个 web component attachShadow 
        // 生成的 shadow dom 节点，因此这句话执行结束后渲染就完成了，
        // 所以 onBeforeUpdate 与 onUpdated 一前一后。
        if (isMounted) {
          // 生命周期
          // 执行了 render 函数后调用 _u - onUpdated
          this._u && this._u.forEach((cb) => cb())
        } else {
          isMounted = true
        }
      })
      // Remove an instance properties that alias reactive properties which
      // might have been set before the element was upgraded.
      for (const propName of propDefs) {
        if (this.hasOwnProperty(propName)) {
          const v = this[propName];
          delete this[propName];
          this[propName] = v;
        }
      }
    }
    // 这几个生命周期是利用 web component 原生 API 实现的
    connectedCallback() {
      // 生命周期
      this._m && this._m.forEach((cb) => cb())
    }
    disconnectedCallback() {
      // 生命周期
      this._um && this._um.forEach((cb) => cb())
    }
    // attributeChangedCallback 生命周期监听自定义组件 html attribute 的变化，
    // 然后将其直接映射到对 this._props[name] 的变化
    attributeChangedCallback(name, oldValue, newValue) {
      this._props[name] = newValue
    }
  }
  for (const propName of propDefs) {
    Object.defineProperty(Component.prototype, propName, {
      get() {
        return this._props[propName];
      },
      set(v) {
        this._props[propName] = v;
      }
    });
  }

  // customElements.define 创建一个原生 web component，
  // 并利用其 API 在初始化时创建一个 closed 节点，该节点
  // 对外部 API 调用关闭，即创建的是一个不会受外部干扰的 web component。
  customElements.define(
    name,
    Component
  )
}

function createLifecycleMethod(name) {
  return (cb) => {
    if (currentInstance) {
      ;(currentInstance[name] || (currentInstance[name] = [])).push(cb)
    }
  }
}

// 为了方便，封装了 createLifecycleMethod 函数，
// 在组件实例上挂载了一些形如 _bm、_bu 的数组，
// 比如 _bm 表示 beforeMount，_bu 表示 beforeUpdate
export const onBeforeMount = createLifecycleMethod('_bm')
export const onMounted = createLifecycleMethod('_m')
export const onBeforeUpdate = createLifecycleMethod('_bu')
export const onUpdated = createLifecycleMethod('_u')
export const onUnmounted = createLifecycleMethod('_um')

export * from 'lit-html'
export * from '@vue/reactivity/dist/reactivity.esm-browser.js'
