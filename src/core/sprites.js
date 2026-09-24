/**
 * 精灵资源加载器。
 *
 * 图片只加载一次，渲染层每帧直接复用；如果图片还没加载好，
 * render.js 会继续使用原来的 Canvas 像素画，避免首帧空白。
 */

const SOURCES = {
  heroBoy: new URL('../assets/hero-boy.png', import.meta.url).href,
  heroGirl: new URL('../assets/hero-girl.png', import.meta.url).href,
  chicken: new URL('../assets/chicken.png', import.meta.url).href,
  cow: new URL('../assets/cow.png', import.meta.url).href,
  grass: new URL('../assets/grass.png', import.meta.url).href,
  soil: new URL('../assets/soil.png', import.meta.url).href,
  seedling: new URL('../assets/seedling.png', import.meta.url).href,
  wheat: new URL('../assets/wheat.png', import.meta.url).href,
  water: new URL('../assets/water.png', import.meta.url).href,
  fence: new URL('../assets/fence.png', import.meta.url).href,
  tree: new URL('../assets/tree.png', import.meta.url).href,
  rock: new URL('../assets/rock.png', import.meta.url).href,
  well: new URL('../assets/well.png', import.meta.url).href,
  house: new URL('../assets/house.png', import.meta.url).href,
  barn: new URL('../assets/barn.png', import.meta.url).href,
  coop: new URL('../assets/coop.png', import.meta.url).href,
  flag: new URL('../assets/flag.png', import.meta.url).href,
};

const images = Object.create(null);
let loading = null;

export function loadSprites() {
  if (loading) return loading;
  loading = Promise.all(Object.entries(SOURCES).map(([key, src]) => new Promise((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      images[key] = image;
      resolve(image);
    };
    image.onerror = () => {
      console.warn(`精灵图加载失败：${src}`);
      resolve(null);
    };
    image.src = src;
  })));
  return loading;
}

export function getSprite(key) {
  const image = images[key];
  return image?.complete && image.naturalWidth > 0 ? image : null;
}
