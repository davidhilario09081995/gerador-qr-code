(function () {
  'use strict';

  // Suporte a acentos e emojis
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

  const form = document.getElementById('formulario');
  const canvas = document.getElementById('canvas');
  const vazio = document.getElementById('vazio');
  const aviso = document.getElementById('aviso');
  const tamanhoValor = document.getElementById('tamanhoValor');
  const btnPng = document.getElementById('baixarPng');
  const btnSvg = document.getElementById('baixarSvg');
  const btnCopiar = document.getElementById('copiar');
  const btnGmn = document.getElementById('baixarGmn');
  const botoesDownload = [btnPng, btnSvg, btnCopiar, btnGmn];

  // Posição do quadro na arte modelos/gmn.png (1414x2000)
  const QUADRO_GMN = { x: 383, y: 869, lado: 620 };
  const btnRemoverLogo = document.getElementById('removerLogo');

  let tipo = 'link';
  let logo = null; // { img, dataUrl }
  let atual = null; // { qr, conteudo, opcoes }

  const v = (nome) => (form.elements[nome].value || '').trim();

  function montarConteudo() {
    if (tipo === 'link') {
      const url = v('link');
      return url === 'https://' || url === 'http://' ? '' : url;
    }
    if (tipo === 'whatsapp') {
      const num = v('wa_numero').replace(/\D/g, '');
      if (!num) return '';
      const msg = v('wa_msg');
      return 'https://wa.me/' + num + (msg ? '?text=' + encodeURIComponent(msg) : '');
    }
    return '';
  }

  function lerOpcoes() {
    return {
      cor: form.elements.cor.value,
      fundo: form.elements.fundo.value,
      transparente: form.elements.transparente.checked,
      tamanho: parseInt(form.elements.tamanho.value, 10),
      margem: 2, // margem pequena fixa
      // Com logo no centro, a correção máxima garante a leitura
      correcao: logo ? 'H' : 'M',
    };
  }

  function luminancia(hex) {
    const n = parseInt(hex.slice(1), 16);
    const canal = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
  }

  function verificarAvisos(op) {
    const msgs = [];
    if (!op.transparente) {
      const lc = luminancia(op.cor), lf = luminancia(op.fundo);
      if (lc > lf) msgs.push('O código está mais claro que o fundo. Muitos leitores não reconhecem QR Codes invertidos.');
      else if ((lf + 0.05) / (lc + 0.05) < 3) msgs.push('Pouco contraste entre as cores. O QR Code pode não ser lido.');
    }
    if (logo) msgs.push('Com logo no centro, teste a leitura com o celular antes de imprimir.');
    aviso.textContent = msgs.join(' ');
    aviso.hidden = msgs.length === 0;
  }

  function criarQr(conteudo, correcao) {
    const qr = qrcode(0, correcao);
    qr.addData(conteudo, 'Byte');
    qr.make();
    return qr;
  }

  // Área do logo: ~22% do lado do QR, alinhada aos módulos
  function areaLogo(total) {
    let lado = Math.floor(total * 0.22);
    if ((total - lado) % 2) lado++;
    const inicio = (total - lado) / 2;
    return { inicio, lado };
  }

  function desenhar(ctx, qr, op, px) {
    const n = qr.getModuleCount();
    const total = n + op.margem * 2;
    const cel = px / total;
    ctx.clearRect(0, 0, px, px);
    if (!op.transparente) {
      ctx.fillStyle = op.fundo;
      ctx.fillRect(0, 0, px, px);
    }
    const area = logo ? areaLogo(n) : null;
    ctx.fillStyle = op.cor;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        if (area && r >= area.inicio && r < area.inicio + area.lado && c >= area.inicio && c < area.inicio + area.lado) continue;
        const x0 = Math.round((c + op.margem) * cel), y0 = Math.round((r + op.margem) * cel);
        const x1 = Math.round((c + op.margem + 1) * cel), y1 = Math.round((r + op.margem + 1) * cel);
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
    }
    if (area) {
      const pad = cel * 0.5;
      const x = (area.inicio + op.margem) * cel + pad;
      const lado = area.lado * cel - pad * 2;
      const { w, h } = encaixar(logo.img, lado);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(logo.img, x + (lado - w) / 2, x + (lado - h) / 2, w, h);
    }
  }

  function encaixar(img, lado) {
    const r = img.naturalWidth / img.naturalHeight;
    return r >= 1 ? { w: lado, h: lado / r } : { w: lado * r, h: lado };
  }

  function gerarSvg(qr, op) {
    const n = qr.getModuleCount();
    const total = n + op.margem * 2;
    const area = logo ? areaLogo(n) : null;
    let caminho = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        if (area && r >= area.inicio && r < area.inicio + area.lado && c >= area.inicio && c < area.inicio + area.lado) continue;
        caminho += 'M' + (c + op.margem) + ' ' + (r + op.margem) + 'h1v1h-1z';
      }
    }
    let svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total +
      '" width="' + op.tamanho + '" height="' + op.tamanho + '" shape-rendering="crispEdges">';
    if (!op.transparente) svg += '<rect width="100%" height="100%" fill="' + op.fundo + '"/>';
    svg += '<path fill="' + op.cor + '" d="' + caminho + '"/>';
    if (area) {
      const pad = 0.5;
      const x = area.inicio + op.margem + pad;
      const lado = area.lado - pad * 2;
      svg += '<image href="' + logo.dataUrl + '" x="' + x + '" y="' + x + '" width="' + lado + '" height="' + lado +
        '" preserveAspectRatio="xMidYMid meet"/>';
    }
    return svg + '</svg>';
  }

  function atualizar() {
    const op = lerOpcoes();
    tamanhoValor.textContent = op.tamanho;
    const conteudo = montarConteudo();
    const temConteudo = conteudo.length > 0;

    vazio.hidden = temConteudo;
    canvas.hidden = !temConteudo;
    botoesDownload.forEach((b) => (b.disabled = !temConteudo));
    if (!temConteudo) {
      atual = null;
      aviso.hidden = true;
      return;
    }

    let qr;
    try {
      qr = criarQr(conteudo, op.correcao);
    } catch (e) {
      atual = null;
      canvas.hidden = true;
      botoesDownload.forEach((b) => (b.disabled = true));
      aviso.textContent = 'Conteúdo grande demais para um QR Code. Reduza o texto.';
      aviso.hidden = false;
      return;
    }

    atual = { qr, conteudo, op };
    const px = 640; // resolução da pré-visualização
    canvas.width = canvas.height = px;
    desenhar(canvas.getContext('2d'), qr, op, px);
    verificarAvisos(op);
  }

  function canvasFinal() {
    const c = document.createElement('canvas');
    c.width = c.height = atual.op.tamanho;
    desenhar(c.getContext('2d'), atual.qr, atual.op, atual.op.tamanho);
    return c;
  }

  function baixar(url, nome) {
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const nomeArquivo = (ext) => 'qrcode-' + tipo + '.' + ext;

  btnPng.addEventListener('click', () => {
    if (!atual) return;
    canvasFinal().toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      baixar(url, nomeArquivo('png'));
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  });

  btnSvg.addEventListener('click', () => {
    if (!atual) return;
    const blob = new Blob([gerarSvg(atual.qr, atual.op)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    baixar(url, nomeArquivo('svg'));
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  btnGmn.addEventListener('click', () => {
    if (!atual) return;
    const arte = new Image();
    arte.onload = () => {
      const c = document.createElement('canvas');
      c.width = arte.naturalWidth;
      c.height = arte.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(arte, 0, 0);

      // Na arte o fundo nunca é transparente, para garantir a leitura
      const op = Object.assign({}, atual.op, { transparente: false });
      const qrCanvas = document.createElement('canvas');
      qrCanvas.width = qrCanvas.height = QUADRO_GMN.lado;
      desenhar(qrCanvas.getContext('2d'), atual.qr, op, QUADRO_GMN.lado);
      ctx.drawImage(qrCanvas, QUADRO_GMN.x, QUADRO_GMN.y);

      c.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        baixar(url, 'qrcode-google-meu-negocio.png');
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 'image/png');
    };
    arte.src = window.MODELO_GMN;
  });

  btnCopiar.addEventListener('click', async () => {
    if (!atual) return;
    const original = btnCopiar.textContent;
    try {
      const blob = await new Promise((res) => canvasFinal().toBlob(res, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      btnCopiar.textContent = 'Copiado!';
    } catch (e) {
      btnCopiar.textContent = 'Não suportado';
    }
    setTimeout(() => (btnCopiar.textContent = original), 1800);
  });

  document.querySelectorAll('.aba').forEach((aba) => {
    aba.addEventListener('click', () => {
      tipo = aba.dataset.tipo;
      document.querySelectorAll('.aba').forEach((a) => a.classList.toggle('ativa', a === aba));
      document.querySelectorAll('.grupo').forEach((g) => (g.hidden = g.dataset.grupo !== tipo));
      atualizar();
      const primeiro = document.querySelector('.grupo[data-grupo="' + tipo + '"] input, .grupo[data-grupo="' + tipo + '"] textarea');
      if (primeiro) primeiro.focus();
    });
  });

  form.elements.logo.addEventListener('change', (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      const img = new Image();
      img.onload = () => {
        logo = { img, dataUrl: leitor.result };
        btnRemoverLogo.hidden = false;
        atualizar();
      };
      img.src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
  });

  btnRemoverLogo.addEventListener('click', () => {
    logo = null;
    form.elements.logo.value = '';
    btnRemoverLogo.hidden = true;
    atualizar();
  });

  form.addEventListener('input', atualizar);
  form.addEventListener('change', (e) => {
    if (e.target.name !== 'logo') atualizar();
  });

  atualizar();
})();
