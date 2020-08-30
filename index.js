
var tagetStacks = []
function isObject(o) {
    return Object.prototype.toString.apply(o)==='[object Object]'
}

function Vue(options) {
    // this
    var vm = this
    vm.options = options
    vm.$data = options.data&&options.data()
    vm.$computed= options.computed
    vm.$watch= options.watch
    this._init = _init.bind(this)
    this.render = render.bind(this)
    this._init(vm)

}

var Watcher = function(vm,expFn,cb,options) {
    this.vm = vm
    if(typeof expFn === 'function'){
        this.getter = expFn
    }else{
        this.getter = parsePath(expFn)
    }
    this.value = undefined
    this.render = options.render
    this.user = options.user
    this.dirty = options.lazy
    this.lazy = options.lazy
    this.deps = [];
    this.newDeps = [];
    this.depIds = new Set();
    this.newDepIds = new Set();
    this.cb = cb||function () {

    }
    this.addDep = function (dep) {
        if(!this.newDepIds.has(dep._id)){
            this.newDepIds.add(dep._id)
            this.newDeps.push(dep)
            if(!this.depIds.has(dep._id)){
                this.deps.push(dep)
            }
        }
    }
    this.update = update.bind(this)
    if(!this.lazy) this.get()

    function update(){
        if(this.user){
            var oldvalue = this.value
            var newValue = this.get()
            if(oldvalue===newValue) return
            this.cb.call(this.vm,newValue,oldvalue)
        }else this.get()
    }
}

Watcher.prototype.get = function(){
    tagetStacks.push(this)
    Depend.target = this
    this.value = this.getter.call(this.vm,this.vm)
    tagetStacks.pop(this)
    Depend.target = tagetStacks[tagetStacks.length-1]
    this.cleanupDeps();
    return this.value
}

Watcher.prototype.cleanupDeps = function(){
    //
    let len = this.deps.length
    while(len--){
        let dep = this.deps[len]
        if(!this.newDepIds.has(dep._id)){
            dep.remove(this)
        }
    }
    var tmp = this.depIds;
    this.depIds = this.newDepIds
    this.newDepIds = tmp;
    this.newDepIds.clear()
    tmp = this.deps;
    this.deps = this.newDeps
    this.newDeps = tmp;
    this.newDeps.length = 0

}

function parsePath(path) {
    var segments = path.split(".")
    return function (obj) {
        for(let i of segments){
            if(!obj) return

            obj = obj[i]
        }
        return obj
    }
}


function initData(vm) {
    for(let key in vm.$data){
        defineActivate(vm.$data,key,vm)
    }
}

function initComputed(vm) {
    var options ={
        lazy:true
    }
    var userDef = {}
    var watchers = {}
    for(let comName in vm.$computed){
        var o = vm.$computed[comName]
        if(isObject(o)){
            userDef.getFn = o.get
            userDef.setFn = o.set||function () {

            }
        }else{
            userDef.getFn = o
        }
        watchers[comName] = new Watcher(vm,userDef.getFn,null,options)
        Object.defineProperty(vm,comName,{
            get(){
                if( watchers[comName].dirty){
                    watchers[comName].get()
                    if(Depend.target){
                        watchers[comName].deps.forEach(dep=>dep.add(Depend.target))
                    }
                    watchers[comName].dirty = false
                }

                return  watchers[comName].value
            },
            set(val){
                userDef.setFn.call(vm,val)
            }
        })
    }
}

function initWatch(vm) {
   for(let key in vm.$watch){
       let handler = vm.$watch[key]
       var cb = function () {

       }
       if(typeof handler=="function"){
           cb = handler
       }else if(isObject(handler)){
           cb = handler['handler']
       }
       new Watcher(vm,key,cb,{user:true})
       if(handler.immediate){
           cb.call(vm)
       }
   }
}

function render(){
    var ele = document.createElement("div")
    ele.style.color = this.color
    ele.style.backgroundColor = this.bgColor
    ele.innerText = this.textCom;
    var ele2 = document.createElement("div")
    ele2.innerText = this.editData;
    var app = document.getElementById('app')
    var nodes = app.childNodes;
    var l = nodes.length
    for(let i = 0; i < l; i++) {
        let node = nodes[0];
        app.removeChild(node);
    }
    app.appendChild(ele)
    app.appendChild(ele2)
}

var _id = 0

function Depend(key) {
    this._id = key
    this.subs = []
    this.add = add.bind(this)
    this.remove = remove.bind(this)
    this.run = run.bind(this)
    this.init = init.bind(this)
    this.init()
    function init() {
        if(Depend.target){
            this.add(Depend.target)
        }
    }
    function add(watcher) {
        this.subs.push(watcher)
        watcher.addDep(this)
    }

    function run() {
        this.subs.forEach(watcher=>{
            watcher.update()
        })
    }

    function remove(watch) {
        var i = this.subs.indexOf(watch)
        if(i!==-1){
            this.subs.splice(i,1)
        }
    }
    //记住以下几点
    //每一个dep实例对应一个data里的属性
    //一个dep里面可能包含n个watcher，渲染watcher是一定有的
    //拿a做例子，在初始化的时候就defineProperty a了，
    // 等到render函数执行的时候，一定会读取a的，这时候栈顶是渲染watcher，所以a对应的dep实例的subs就是这个渲染watcher
}

function defineActivate(data,key,vm) {
    let f = false
    let t = data[key]
    var dep =  new Depend(key)
    Object.defineProperty(data,key,{
        get:function (value) {
            if(Depend.target){
                dep.add(Depend.target)
            }
            return t
        },
        set:function (val) {
            t  = val
            dep&&dep.subs.forEach(d=>d.dirty=true)
            dep.run()
        }
    })
    Object.defineProperty(vm,key,{
        get:function (value) {
            return data[key]
        },
        set:function (val) {
            data[key] = val
        }
    })
}

function _init(vm) {
    initData(vm)
    initComputed(vm)
    initWatch(vm)
    new Watcher(vm,vm.render,null,true)
    setTimeout(function () {
        vm.editData = 'blue'
    },500)
    setTimeout(function () {
        vm.text = '12345'
    },2000)
    //editDatavalue
    setTimeout(function () {
        vm.editDatavalue = 'editDatavalue2222'
    },3000)
}