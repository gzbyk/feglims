// ═══════════════════════════════════════════
//  FEGLIMS v3.4 — flybase.js
//  FlyBase/NCBI Integration: genotype linking, gene info
// ═══════════════════════════════════════════
import {
  db, collection, doc, updateDoc, query, where, getDocs
} from './firebase.js';

const A = window.APP;

const FLYBASE_SEARCH_URL = 'https://flybase.org/search/';
const FLYBASE_REPORT_URL = 'https://flybase.org/reports/';
const NCBI_GENE_URL = 'https://www.ncbi.nlm.nih.gov/gene/?term=';
const NCBI_PUBMED_URL = 'https://pubmed.ncbi.nlm.nih.gov/?term=';

// Gene symbol patterns commonly found in Drosophila genotypes
const GENE_PATTERN = /\b([a-z]{2,})\[([^\]]+)\]/gi; // e.g. w[*], sn[3]
const FLYBASE_ID_PATTERN = /FB(gn|st|al|tp|ab|ba|cl|ig|ti|pp)\d{7}/g;
const BALANCER_PATTERN = /\b(CyO|TM3|TM6B?|FM7[a-c]?|SM6[a-b]?|In\(\d[LR]+\))\b/g;

// Parse genotype string to extract gene symbols
function parseGenotype(genotype) {
  if (!genotype) return { genes: [], flybaseIds: [], balancers: [] };

  const genes = [];
  const flybaseIds = [];
  const balancers = [];

  // Extract gene symbols with alleles
  let match;
  const geneRe = /\b([A-Za-z][A-Za-z0-9]*)\[([^\]]*)\]/g;
  while ((match = geneRe.exec(genotype)) !== null) {
    genes.push({ symbol: match[1], allele: match[2], full: match[0] });
  }

  // Extract FlyBase IDs if present
  const fbRe = /FB(gn|st|al|tp|ab|ba|cl|ig|ti|pp)\d{7}/g;
  while ((match = fbRe.exec(genotype)) !== null) {
    flybaseIds.push(match[0]);
  }

  // Extract balancer chromosomes
  const balRe = /\b(CyO|TM3|TM6B?|FM7[a-c]?|SM6[a-b]?)\b/g;
  while ((match = balRe.exec(genotype)) !== null) {
    balancers.push(match[0]);
  }

  // Also extract P-element constructs
  const pRe = /P\{([^}]+)\}/g;
  while ((match = pRe.exec(genotype)) !== null) {
    const parts = match[1].split('=');
    if (parts.length > 1) genes.push({ symbol: parts[0], allele: parts.slice(1).join('='), full: match[0], isConstruct: true });
  }

  return { genes, flybaseIds, balancers };
}

// Render FlyBase info panel for a stock
export function renderFlyBasePanel(stock) {
  if (!stock || !stock.genotype) return '';

  const parsed = parseGenotype(stock.genotype);
  if (parsed.genes.length === 0 && parsed.flybaseIds.length === 0 && parsed.balancers.length === 0) {
    return `<div style="font-size:12px;color:var(--text3)">${A.lang==='tr'?'Genotipte tanınan gen sembolü bulunamadı.':'No recognized gene symbols found in genotype.'}</div>`;
  }

  let html = '<div style="margin-top:12px">';

  // Genes
  if (parsed.genes.length > 0) {
    html += `<div class="fl" style="margin-bottom:8px">🧬 ${A.lang==='tr'?'Tespit Edilen Genler':'Detected Genes'}</div>`;
    html += parsed.genes.map(g => {
      const searchTerm = g.isConstruct ? g.allele.split(',')[0] : g.symbol;
      return `<div class="row" style="gap:8px;margin-bottom:6px;padding:6px 10px;background:var(--bg2);border-radius:6px">
        <code style="font-size:12px;font-weight:600;color:var(--accent)">${g.full}</code>
        <div style="flex:1"></div>
        <a href="${FLYBASE_SEARCH_URL}${encodeURIComponent(searchTerm)}" target="_blank" class="btn btn-ghost btn-sm" style="font-size:11px;text-decoration:none">
          🪰 FlyBase
        </a>
        <a href="${NCBI_GENE_URL}${encodeURIComponent(searchTerm + ' Drosophila')}" target="_blank" class="btn btn-ghost btn-sm" style="font-size:11px;text-decoration:none">
          🧬 NCBI Gene
        </a>
        <a href="${NCBI_PUBMED_URL}${encodeURIComponent(searchTerm + ' Drosophila melanogaster')}" target="_blank" class="btn btn-ghost btn-sm" style="font-size:11px;text-decoration:none">
          📄 PubMed
        </a>
      </div>`;
    }).join('');
  }

  // FlyBase IDs
  if (parsed.flybaseIds.length > 0) {
    html += `<div class="fl" style="margin:12px 0 8px">🔗 FlyBase IDs</div>`;
    html += parsed.flybaseIds.map(id =>
      `<a href="${FLYBASE_REPORT_URL}${id}" target="_blank" style="display:inline-block;margin:2px 4px;padding:4px 10px;background:var(--bg2);border-radius:4px;font-size:12px;color:var(--accent);text-decoration:none">${id}</a>`
    ).join('');
  }

  // Balancers
  if (parsed.balancers.length > 0) {
    html += `<div class="fl" style="margin:12px 0 8px">⚖️ ${A.lang==='tr'?'Dengeleyiciler':'Balancers'}</div>`;
    html += `<div class="row" style="gap:6px;flex-wrap:wrap">${parsed.balancers.map(b =>
      `<a href="${FLYBASE_SEARCH_URL}${encodeURIComponent(b)}" target="_blank" style="padding:4px 10px;background:#ffb54522;border-radius:4px;font-size:12px;color:#ffb545;text-decoration:none">${b}</a>`
    ).join('')}</div>`;
  }

  html += '</div>';
  return html;
}

// Auto-link genotype in stock detail view
export function getGenotypeLinks(genotype) {
  if (!genotype) return genotype;
  let result = genotype;

  // Wrap gene[allele] patterns with FlyBase links
  result = result.replace(/\b([A-Za-z][A-Za-z0-9]*)\[([^\]]*)\]/g, (match, gene) => {
    return `<a href="${FLYBASE_SEARCH_URL}${encodeURIComponent(gene)}" target="_blank" style="color:var(--accent);text-decoration:underline dotted" title="FlyBase: ${gene}">${match}</a>`;
  });

  // Link FlyBase IDs
  result = result.replace(/(FB(?:gn|st|al|tp|ab|ba|cl|ig|ti|pp)\d{7})/g, (match) => {
    return `<a href="${FLYBASE_REPORT_URL}${match}" target="_blank" style="color:var(--accent);text-decoration:underline dotted">${match}</a>`;
  });

  return result;
}

// Batch link all stocks' genotypes to FlyBase
window.batchFlyBaseLink = async () => {
  const snap = await getDocs(query(collection(db, 'stocks'), where('labId', '==', A.userData.labId)));
  let linked = 0;
  for (const d of snap.docs) {
    const s = d.data();
    if (s.genotype && !s.flybaseLinked) {
      const parsed = parseGenotype(s.genotype);
      if (parsed.genes.length > 0 || parsed.flybaseIds.length > 0) {
        await updateDoc(doc(db, 'stocks', d.id), {
          flybaseLinked: true,
          detectedGenes: parsed.genes.map(g => g.symbol),
          detectedBalancers: parsed.balancers,
          flybaseIds: parsed.flybaseIds,
        });
        linked++;
      }
    }
  }
  toast(`${linked} ${A.lang==='tr'?'stok FlyBase\'e bağlandı':'stocks linked to FlyBase'}`, 'ok');
};

export { parseGenotype };
