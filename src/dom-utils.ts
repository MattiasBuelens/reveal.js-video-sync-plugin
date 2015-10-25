export function isAttached(node:Node) {
    while (node && node !== document) {
        node = node.parentNode;
    }
    return (node === document);
}

export function hasClass(element:HTMLElement, className:string) {
    return (' ' + element.className.trim() + ' ').indexOf(' ' + className + ' ') !== -1;
}

export function addClass(element:HTMLElement, className:string) {
    var classes = ' ' + element.className.trim() + ' ';
    if (classes.indexOf(' ' + className + ' ') === -1) {
        classes += ' ' + className;
    }
    element.className = classes.trim();
}

export function removeClass(element:HTMLElement, className:string) {
    var classes = ' ' + element.className.trim() + ' ';
    while (classes.indexOf(' ' + className + ' ') !== -1) {
        classes = classes.replace(' ' + className + ' ', ' ');
    }
    element.className = classes.trim();
}
