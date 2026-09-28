# Servidor local simples para testar o site (não precisa instalar nada)
param([int]$Porta = 8080)

$raiz = $PSScriptRoot
$tipos = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.ico'  = 'image/x-icon'
}

$ouvinte = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Porta)
$ouvinte.Start()

$ips = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254*' }).IPAddress
Write-Host ""
Write-Host "Servidor rodando! Abra no navegador:" -ForegroundColor Green
Write-Host "  Neste computador:  http://localhost:$Porta"
foreach ($ip in $ips) { Write-Host "  No celular (mesmo Wi-Fi):  http://${ip}:$Porta" }
Write-Host ""
Write-Host "Para parar, feche esta janela ou pressione Ctrl+C."

try {
  while ($true) {
    $cliente = $ouvinte.AcceptTcpClient()
    try {
      $fluxo = $cliente.GetStream()
      # Evita travar em conexões abertas pelo navegador sem pedido
      $fluxo.ReadTimeout = 2000
      $fluxo.WriteTimeout = 5000
      $leitor = [System.IO.StreamReader]::new($fluxo)
      $linha = $leitor.ReadLine()
      while (($l = $leitor.ReadLine()) -ne $null -and $l -ne '') { }

      $caminho = '/'
      if ($linha -match '^\w+\s+(\S+)') { $caminho = [Uri]::UnescapeDataString(($Matches[1] -split '\?')[0]) }
      if ($caminho -eq '/') { $caminho = '/index.html' }

      $arquivo = [System.IO.Path]::GetFullPath((Join-Path $raiz $caminho.TrimStart('/')))
      if ($arquivo.StartsWith($raiz) -and (Test-Path $arquivo -PathType Leaf)) {
        $corpo = [System.IO.File]::ReadAllBytes($arquivo)
        $tipo = $tipos[[System.IO.Path]::GetExtension($arquivo).ToLower()]
        if (-not $tipo) { $tipo = 'application/octet-stream' }
        $status = '200 OK'
      } else {
        $corpo = [System.Text.Encoding]::UTF8.GetBytes('Arquivo nao encontrado')
        $tipo = 'text/plain; charset=utf-8'
        $status = '404 Not Found'
      }

      $cab = "HTTP/1.1 $status`r`nContent-Type: $tipo`r`nContent-Length: $($corpo.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
      $bytesCab = [System.Text.Encoding]::ASCII.GetBytes($cab)
      $fluxo.Write($bytesCab, 0, $bytesCab.Length)
      $fluxo.Write($corpo, 0, $corpo.Length)
      $fluxo.Flush()
    } catch {
    } finally {
      $cliente.Close()
    }
  }
} finally {
  $ouvinte.Stop()
}
