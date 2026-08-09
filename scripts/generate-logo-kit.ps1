param(
    [string]$OutputDirectory = ''
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $projectRoot 'assets\branding\v2'
}

$sourcePath = Join-Path $projectRoot 'assets\branding\isrp-logo-silver.jpg'
if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "ISRP source mark not found: $sourcePath"
}

[System.IO.Directory]::CreateDirectory($OutputDirectory) | Out-Null
$sourceLogo = [System.Drawing.Image]::FromFile($sourcePath)
$sourceCrop = New-Object System.Drawing.Rectangle(280, 65, 840, 1180)
$navy = [System.Drawing.Color]::FromArgb(29, 58, 105)
$blue = [System.Drawing.Color]::FromArgb(79, 118, 184)
$white = [System.Drawing.Color]::White

function New-Canvas {
    param([int]$Width, [int]$Height)

    $bitmap = New-Object System.Drawing.Bitmap(
        $Width,
        $Height,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    $bitmap.SetResolution(144, 144)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.Clear([System.Drawing.Color]::Transparent)

    return @($bitmap, $graphics)
}

function New-MarkAttributes {
    param(
        [System.Drawing.Color]$Color,
        [float]$Opacity = 1
    )

    $attributes = New-Object System.Drawing.Imaging.ImageAttributes
    $attributes.SetColorKey(
        [System.Drawing.Color]::FromArgb(0, 0, 0),
        [System.Drawing.Color]::FromArgb(30, 30, 30)
    )
    $matrix = New-Object System.Drawing.Imaging.ColorMatrix
    $matrix.Matrix00 = 0
    $matrix.Matrix11 = 0
    $matrix.Matrix22 = 0
    $matrix.Matrix33 = $Opacity
    $matrix.Matrix40 = $Color.R / 255
    $matrix.Matrix41 = $Color.G / 255
    $matrix.Matrix42 = $Color.B / 255
    $attributes.SetColorMatrix($matrix)
    return $attributes
}

function Draw-Mark {
    param(
        [System.Drawing.Graphics]$Graphics,
        [System.Drawing.Rectangle]$Destination,
        [System.Drawing.Color]$Color,
        [float]$Opacity = 1
    )

    $attributes = New-MarkAttributes -Color $Color -Opacity $Opacity
    $Graphics.DrawImage(
        $sourceLogo,
        $Destination,
        $sourceCrop.X,
        $sourceCrop.Y,
        $sourceCrop.Width,
        $sourceCrop.Height,
        [System.Drawing.GraphicsUnit]::Pixel,
        $attributes
    )
    $attributes.Dispose()
}

function Save-Canvas {
    param(
        [System.Drawing.Bitmap]$Bitmap,
        [System.Drawing.Graphics]$Graphics,
        [string]$FileName
    )

    $outputPath = Join-Path $OutputDirectory $FileName
    $Bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $Graphics.Dispose()
    $Bitmap.Dispose()
    Write-Output $outputPath
}

function New-TransparentMark {
    param(
        [string]$FileName,
        [System.Drawing.Color]$Color,
        [float]$Opacity = 1,
        [int]$Size = 1024
    )

    $canvas = New-Canvas -Width $Size -Height $Size
    $bitmap = $canvas[0]
    $graphics = $canvas[1]
    $height = [int]($Size * 0.86)
    $width = [int]($height * ($sourceCrop.Width / $sourceCrop.Height))
    $destination = New-Object System.Drawing.Rectangle(
        [int](($Size - $width) / 2),
        [int](($Size - $height) / 2),
        $width,
        $height
    )
    Draw-Mark -Graphics $graphics -Destination $destination -Color $Color -Opacity $Opacity
    Save-Canvas -Bitmap $bitmap -Graphics $graphics -FileName $FileName
}

function New-SquareLogo {
    param(
        [string]$FileName,
        [ValidateSet('primary', 'dark', 'light')]
        [string]$Theme
    )

    $canvas = New-Canvas -Width 1024 -Height 1024
    $bitmap = $canvas[0]
    $graphics = $canvas[1]
    $rectangle = New-Object System.Drawing.Rectangle(0, 0, 1024, 1024)

    if ($Theme -eq 'primary') {
        $background = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
            $rectangle,
            [System.Drawing.Color]::FromArgb(22, 48, 101),
            [System.Drawing.Color]::FromArgb(128, 174, 216),
            25
        )
        $markColor = $white
    } elseif ($Theme -eq 'dark') {
        $background = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 29, 53))
        $markColor = $white
    } else {
        $background = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(246, 248, 252))
        $markColor = $navy
    }

    $graphics.FillRectangle($background, $rectangle)
    $border = New-Object System.Drawing.Pen(
        $(if ($Theme -eq 'light') { [System.Drawing.Color]::FromArgb(40, 29, 58, 105) } else { [System.Drawing.Color]::FromArgb(65, 255, 255, 255) }),
        10
    )
    $graphics.DrawRectangle($border, 34, 34, 956, 956)
    Draw-Mark -Graphics $graphics -Destination (New-Object System.Drawing.Rectangle(238, 75, 548, 770)) -Color $markColor

    $font = New-Object System.Drawing.Font('Arial', 56, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $brush = New-Object System.Drawing.SolidBrush($markColor)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $graphics.DrawString('ILLINOIS STATE ROLEPLAY', $font, $brush, (New-Object System.Drawing.RectangleF(80, 878, 864, 76)), $format)

    $format.Dispose()
    $brush.Dispose()
    $font.Dispose()
    $border.Dispose()
    $background.Dispose()
    Save-Canvas -Bitmap $bitmap -Graphics $graphics -FileName $FileName
}

function New-CircularBadge {
    $canvas = New-Canvas -Width 1024 -Height 1024
    $bitmap = $canvas[0]
    $graphics = $canvas[1]
    $ellipse = New-Object System.Drawing.Rectangle(34, 34, 956, 956)
    $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $ellipse,
        [System.Drawing.Color]::FromArgb(20, 43, 91),
        [System.Drawing.Color]::FromArgb(111, 157, 205),
        40
    )
    $outline = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 14)
    $graphics.FillEllipse($gradient, $ellipse)
    $graphics.DrawEllipse($outline, $ellipse)
    Draw-Mark -Graphics $graphics -Destination (New-Object System.Drawing.Rectangle(238, 110, 548, 770)) -Color $white

    $outline.Dispose()
    $gradient.Dispose()
    Save-Canvas -Bitmap $bitmap -Graphics $graphics -FileName 'isrp-circular-badge-v2.png'
}

function New-BotIcon {
    $canvas = New-Canvas -Width 1024 -Height 1024
    $bitmap = $canvas[0]
    $graphics = $canvas[1]
    $rectangle = New-Object System.Drawing.Rectangle(0, 0, 1024, 1024)
    $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rectangle,
        [System.Drawing.Color]::FromArgb(20, 43, 91),
        [System.Drawing.Color]::FromArgb(111, 157, 205),
        40
    )
    $graphics.FillRectangle($gradient, $rectangle)
    $ring = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 255, 255, 255), 10)
    $graphics.DrawEllipse($ring, 58, 58, 908, 908)
    Draw-Mark -Graphics $graphics -Destination (New-Object System.Drawing.Rectangle(235, 105, 554, 778)) -Color $white

    $ring.Dispose()
    $gradient.Dispose()
    Save-Canvas -Bitmap $bitmap -Graphics $graphics -FileName 'isrp-bot-icon-v2.png'
}

function New-Wordmark {
    param(
        [string]$FileName,
        [System.Drawing.Color]$PrimaryColor,
        [System.Drawing.Color]$AccentColor
    )

    $canvas = New-Canvas -Width 1800 -Height 500
    $bitmap = $canvas[0]
    $graphics = $canvas[1]
    Draw-Mark -Graphics $graphics -Destination (New-Object System.Drawing.Rectangle(62, 42, 250, 352)) -Color $PrimaryColor

    $divider = New-Object System.Drawing.Pen($AccentColor, 5)
    $graphics.DrawLine($divider, 365, 80, 365, 420)
    $titleStyle = [System.Drawing.FontStyle]::Bold -bor [System.Drawing.FontStyle]::Italic
    $titleFont = New-Object System.Drawing.Font('Arial', 118, $titleStyle, [System.Drawing.GraphicsUnit]::Pixel)
    $subtitleFont = New-Object System.Drawing.Font('Arial', 56, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $primaryBrush = New-Object System.Drawing.SolidBrush($PrimaryColor)
    $accentBrush = New-Object System.Drawing.SolidBrush($AccentColor)
    $graphics.DrawString('ILLINOIS STATE', $titleFont, $primaryBrush, 425, 112)
    $graphics.DrawString('R O L E P L A Y', $subtitleFont, $accentBrush, 432, 282)

    $accentBrush.Dispose()
    $primaryBrush.Dispose()
    $subtitleFont.Dispose()
    $titleFont.Dispose()
    $divider.Dispose()
    Save-Canvas -Bitmap $bitmap -Graphics $graphics -FileName $FileName
}

New-TransparentMark -FileName 'isrp-mark-white-v2.png' -Color $white
New-TransparentMark -FileName 'isrp-mark-navy-v2.png' -Color $navy
New-SquareLogo -FileName 'isrp-logo-primary-v2.png' -Theme 'primary'
New-SquareLogo -FileName 'isrp-logo-dark-v2.png' -Theme 'dark'
New-SquareLogo -FileName 'isrp-logo-light-v2.png' -Theme 'light'
New-CircularBadge
New-BotIcon
New-Wordmark -FileName 'isrp-wordmark-white-v2.png' -PrimaryColor $white -AccentColor ([System.Drawing.Color]::FromArgb(185, 215, 245))
New-Wordmark -FileName 'isrp-wordmark-navy-v2.png' -PrimaryColor $navy -AccentColor $blue
New-TransparentMark -FileName 'isrp-watermark-white-v2.png' -Color $white -Opacity 0.55 -Size 512

$sourceLogo.Dispose()
