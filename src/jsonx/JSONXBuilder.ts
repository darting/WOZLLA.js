module WOZLLA.jsonx {

    function emptyCallback(root:WOZLLA.GameObject, done:Function) {
        done();
    }
    // reference: @src#asGameObject

    export class JSONXBuilder {

        public static Factory:Function;

        public static create():JSONXBuilder {
            if(JSONXBuilder.Factory) {
                return <JSONXBuilder>(new (<any>(JSONXBuilder.Factory))());
            }
            return new JSONXBuilder();
        }

        public static createInner(outerBuilder:JSONXBuilder) {
            if(JSONXBuilder.Factory) {
                return <JSONXBuilder>(new (<any>(JSONXBuilder.Factory))(outerBuilder));
            }
            return new JSONXBuilder();
        }

        private src;
        private data;
        private err;
        private root:WOZLLA.GameObject;
        private doLoad:boolean = false;
        private doInit:boolean = false;
        private async:boolean = true;
        private loadCallback:(root:WOZLLA.GameObject, done:Function) => void;
        private newCallback:(root:WOZLLA.GameObject, done:Function) => void;

        private uuidMap:any = {};

        getByUUID(uuid) {
            return this.uuidMap[uuid];
        }

        setSync():void {
            this.async = false;
        }

        instantiateWithSrc(src, callback:(root:WOZLLA.GameObject, done:Function) => void = emptyCallback) {
            this.src = src;
            this.newCallback = callback;
            return this;
        }

        instantiateWithJSON(data:any, callback:(root:WOZLLA.GameObject, done:Function) => void = emptyCallback) {
            this.data = data;
            this.newCallback = callback;
            return this;
        }

        load(callback:(root:WOZLLA.GameObject, done:Function) => void = emptyCallback) {
            this.doLoad = true;
            this.loadCallback = callback;
            return this;
        }

        init() {
            if(this.doLoad) {
                this.doInit = true;
            } else {
                this.err = 'JSONXBuilder: init must after load';
            }
            return this;
        }

        build(callback:(error:any, root:WOZLLA.GameObject) => void) {
            this._loadJSONData(() => {
                if(this._checkError(callback)) return;
                this._newGameObjectTree(() => {
                    if(this._checkError(callback)) return;
                    if(!this.doLoad) {
                        callback(this.err, this.root);
                        return;
                    }
                    this.newCallback(this.root, () => {
                        this._loadAssets(() => {
                            if(this._checkError(callback)) return;
                            if(!this.doInit) {
                                callback(this.err, this.root);
                                return;
                            }
                            this._init();
                            callback(this.err, this.root);
                        });
                    });
                });
            });
        }

        protected _checkError(callback:(error:any, root:WOZLLA.GameObject) => void) {
            if(this.err) {
                callback(this.err, null);
                return true;
            }
            return false;
        }

        protected _loadJSONData(callback:Function) {
            if(this.src && !this.data) {
                var baseDir = Director.getInstance().assetLoader.getBaseDir();
                WOZLLA.utils.Ajax.request({
                    url: baseDir ? baseDir + '/' + this.src : this.src,
                    dataType: 'json',
                    async: this.async,
                    withCredentials: true,
                    success: (data) => {
                        this.data = data;
                        callback && callback();
                    },
                    error: (err) => {
                        this.err = err;
                        callback && callback()
                    }
                });
            } else {
                callback && callback();
            }
        }

        protected _newGameObjectTree(callback:Function) {
            this._newGameObject(this.data.root, (root:WOZLLA.GameObject) => {
                this.root = root;
                callback && callback();
            });
        }

        protected _newGameObject(data:any, callback:(gameObj:WOZLLA.GameObject) => void) {
            var me = this;
            var gameObj = new WOZLLA.GameObject(data.rect);
            gameObj._uuid = data.uuid;
            this.uuidMap[data.uuid] = gameObj;
            gameObj.id = data.id;
            gameObj.z = data.z;
            gameObj.name = data.name;
            gameObj.active = data.active;
            gameObj.visible = data.visible;
            gameObj.touchable = data.touchable;
            gameObj.transform.set(data.transform);

            var components:Array<any> = data.components;
            if(components && components.length > 0) {
                components.forEach((compData:any) => {
                    gameObj.addComponent(this._newComponent(compData, gameObj));
                });
            }

            var children:Array<any> = data.children;
            if(!children || children.length === 0) {
                callback(gameObj);
                return;
            }

            var index = 0;
            function next() {
                var childData = children[index++];
                if(!childData) {
                    gameObj.sortChildren();
                    callback(gameObj);
                    return;
                }
                if(childData.reference) {
                    me._newReferenceObject(childData, (child) => {
                        if(child) {
                            gameObj.addChild(child, false);
                        }
                        next();
                    });
                } else {
                    me._newGameObject(childData, (child) => {
                        gameObj.addChild(child, false);
                        next();
                    });
                }
            }

            next();
        }

        protected _newReferenceObject(data:any, callback:(gameObj:WOZLLA.GameObject) => void) {
            var builder = JSONXBuilder.createInner(this);
            builder.instantiateWithSrc(data.reference).build((err:any, root:WOZLLA.GameObject) => {
                if(err) {
                    this.err = err;
                    console.log('fail to load reference: ' + data.reference);
                }
                else if(root) {
                    var refObj;
                    if(root.rectTransform) {
                        refObj = new WOZLLA.GameObject(true);
                    } else {
                        refObj = new WOZLLA.GameObject();
                    }
                    refObj._uuid = data.uuid;
                    this.uuidMap[data.uuid] = refObj;
                    refObj.name = data.name;
                    refObj.id = data.id;
                    refObj.z = data.z;
                    refObj.active = data.active;
                    refObj.visible = data.visible;
                    refObj.touchable = data.touchable;
                    refObj.transform.set(data.transform);
                    refObj.addChild(root);
                }
                callback(refObj);
            });
        }

        protected _newComponent(compData:any, gameObj:WOZLLA.GameObject):WOZLLA.Component {
            var component = WOZLLA.Component.create(compData.name);
            var config = WOZLLA.Component.getConfig(compData.name);
            component._uuid = compData.uuid;
            this.uuidMap[compData.uuid] = component;
            component.gameObject = gameObj;
            this._applyComponentProperties(component, config.properties, compData);
            return component;
        }

        protected _applyComponentProperties(component, properties:any, compData:any) {
            if(properties && properties.length > 0) {
                properties.forEach((prop) => {
                    if(prop.group) {
                        this._applyComponentProperties(component, prop.properties, compData);
                    } else if(prop.extend) {
                        var config = Component.getConfig(prop.extend);
                        if(config) {
                            this._applyComponentProperties(component, config.properties, compData);
                        }
                    } else {
                        var value = compData.properties[prop.name];
                        value = value == void 0 ? prop.defaultValue : value;
                        if (prop.convert && value) {
                            value = prop.convert(value);
                        }
                        component[prop.name] = value;
                    }
                });
            }
        }

        protected _loadAssets(callback:Function) {
            this.root.loadAssets(callback);
        }

        protected _init() {
            this.root.init();
        }

    }

}