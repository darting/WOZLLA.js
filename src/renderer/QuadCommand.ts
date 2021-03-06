/// <reference path="ITexture.ts"/>
/// <reference path="Quad.ts"/>
/// <reference path="RenderCommandBase.ts"/>
/// <reference path="ILayerManager.ts"/>
/// <reference path="../utils/ObjectPool.ts"/>
module WOZLLA.renderer {

    var quadCommandPool;

    /**
     * @class WOZLLA.renderer.QuadCommand
     * @extends WOZLLA.renderer.RenderCommandBase
     */
    export class QuadCommand extends RenderCommandBase implements WOZLLA.utils.Poolable {

        public static init(globalZ:number, layer:string, texture:ITexture, materialId:string, quad:Quad, flags?:string):QuadCommand {
            var quadCommand = quadCommandPool.retain();
            quadCommand.initWith(globalZ, layer, texture, materialId, quad, flags);
            return quadCommand;
        }

        isPoolable:boolean = true;

        get texture():ITexture { return this._texture; }
        get materialId():string { return this._materialId; }
        get quad():Quad { return this._quad; }
        _texture:ITexture;
        _materialId:string;
        _quad:Quad;

        constructor(globalZ:number, layer:string) {
            super(globalZ, layer, null);
        }

        initWith(globalZ:number, layer:string, texture:ITexture, materialId:string, quad, flags?:string):void {
            this._globalZ = globalZ;
            this._layer = layer;
            this._texture = texture;
            this._materialId = materialId;
            this._quad = quad;
            this._flags = flags;
        }

        release() {
            this._layer = null;
            this._texture = null;
            this._materialId = null;
            this._quad = null;
            this._flags = null;
            quadCommandPool.release(this);
        }

    }

    quadCommandPool = new WOZLLA.utils.ObjectPool<QuadCommand>(200, ():QuadCommand => {
        return new QuadCommand(0, ILayerManager.DEFAULT);
    });

}