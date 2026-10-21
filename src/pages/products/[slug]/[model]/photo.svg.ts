import type { APIRoute, GetStaticPaths } from 'astro';
import { brands } from '../../../../data/brands';
import { placeholderSvg } from '../../../../data/productArt';
import { brandSites, publicProducts, type Product } from '../../../../data/products';

/** The labelled placeholder photo for each model page (also its JSON-LD image) — see src/data/productArt.ts. */
export const getStaticPaths = (() => publicProducts().map((p) => ({ params: { slug: p.category, model: p.slug }, props: { product: p } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const p = (props as { product: Product }).product;
  const brand = brandSites[p.brand]?.name ?? brands.find((b) => b.id === p.brand)?.name ?? p.brand;
  return new Response(placeholderSvg(p, brand), { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } });
};
