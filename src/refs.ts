/// <reference path="../node_modules/typescript.api/decl/ecma.d.ts"/>

interface CustomEvent {
    detail: {};
    initCustomEvent(typeArg: string, canBubbleArg: boolean, cancelableArg: boolean, detailArg: {}): void;
}

declare var CustomEvent: {
    prototype: CustomEvent;
    new (eventType: string, data: {}): CustomEvent;
}

//bad HTMLElement stub
declare class HTMLElement{
    static registry;
    static register;
    static name;
    static safeAttributes;
    public removeEventListener(ename, fn);
    public addEventListener(ename, fn);
    public constructor;
    public querySelector;
    public querySelectorAll;
    public setAttribute;
    public getAttribute;
    public removeAttribute;
    public disabled;
    public disable();
    public fire(evt);
    public states;
    static exposeClasses;
    public _state;
    static autoinit;
    static defaults;
    static create;

    //draggable
    public treshold;
    public autoscroll;
    public within;
    public pin;
    public group;
    public ghost;
    public translate;
    public precision;
    public sniper;
    public axis;
    public native;
    public _x;
    public _y;
    public style;
    public offsets;
    public oX;
    public oY;
    public offsetHeight;
    public offsetWidth;
    public $within;
    public limits;
    public dragstate;
    public state;

    _reflectAttrTimeout;
    _preventOneAttrChange;
    _observer;
    _observeConfig;
}

declare var MutationObserver

declare var console;
declare var document;
declare var window;
declare var NodeList;
declare var Element;
declare function getComputedStyle(elt, pseudoElt?);
declare function setTimeout(a, b);
declare function clearTimeout(a);
