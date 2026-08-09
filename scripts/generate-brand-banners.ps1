param(
    [string]$OutputDirectory = ''
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $projectRoot 'assets\thumbnails'
}

$logoPath = Join-Path $projectRoot 'assets\branding\isrp-logo-silver.jpg'
if (-not (Test-Path -LiteralPath $logoPath)) {
    throw "ISRP logo not found: $logoPath"
}

[System.IO.Directory]::CreateDirectory($OutputDirectory) | Out-Null

function New-RoundedRectanglePath {
    param(
        [System.Drawing.RectangleF]$Rectangle,
        [float]$Radius
    )

    $diameter = $Radius * 2
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($Rectangle.X, $Rectangle.Y, $diameter, $diameter, 180, 90)
    $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Y, $diameter, $diameter, 270, 90)
    $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Bottom - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($Rectangle.X, $Rectangle.Bottom - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-FittedFont {
    param(
        [System.Drawing.Graphics]$Graphics,
        [string]$Text,
        [float]$MaximumWidth,
        [float]$StartingSize
    )

    $style = [System.Drawing.FontStyle]::Bold -bor [System.Drawing.FontStyle]::Italic
    $size = $StartingSize
    while ($size -ge 72) {
        $font = New-Object System.Drawing.Font('Arial', $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
        if ($Graphics.MeasureString($Text, $font).Width -le $MaximumWidth) {
            return $font
        }
        $font.Dispose()
        $size -= 4
    }

    return New-Object System.Drawing.Font('Arial', 72, $style, [System.Drawing.GraphicsUnit]::Pixel)
}

function New-ISRPBanner {
    param(
        [string]$Title,
        [string]$FileName
    )

    $width = 1800
    $height = 600
    $bitmap = New-Object System.Drawing.Bitmap($width, $height)
    $bitmap.SetResolution(144, 144)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $canvas = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
    $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $canvas,
        [System.Drawing.Color]::FromArgb(18, 45, 98),
        [System.Drawing.Color]::FromArgb(142, 187, 226),
        18
    )
    $graphics.FillRectangle($gradient, $canvas)

    $glow = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Rectangle(0, 0, 900, $height)),
        [System.Drawing.Color]::FromArgb(75, 255, 255, 255),
        [System.Drawing.Color]::FromArgb(0, 255, 255, 255),
        0
    )
    $graphics.FillRectangle($glow, 0, 0, 900, $height)

    $innerRectangle = New-Object System.Drawing.RectangleF(30, 30, 1740, 540)
    $innerPath = New-RoundedRectanglePath -Rectangle $innerRectangle -Radius 34
    $innerFill = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(24, 255, 255, 255))
    $innerBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(58, 255, 255, 255), 3)
    $graphics.FillPath($innerFill, $innerPath)
    $graphics.DrawPath($innerBorder, $innerPath)

    $smallFont = New-Object System.Drawing.Font('Arial', 24, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $smallBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(205, 255, 255, 255))
    $graphics.DrawString('ILLINOIS STATE ROLEPLAY', $smallFont, $smallBrush, 78, 68)

    $titleFont = New-FittedFont -Graphics $graphics -Text $Title -MaximumWidth 1580 -StartingSize 210
    $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $titleFormat = New-Object System.Drawing.StringFormat
    $titleFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $titleFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
    $graphics.DrawString(
        $Title,
        $titleFont,
        $titleBrush,
        (New-Object System.Drawing.RectangleF(100, 115, 1600, 235)),
        $titleFormat
    )

    $taglineFont = New-Object System.Drawing.Font('Arial', 49, [System.Drawing.FontStyle]::Italic, [System.Drawing.GraphicsUnit]::Pixel)
    $taglineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(225, 255, 255, 255))
    $taglineFormat = New-Object System.Drawing.StringFormat
    $taglineFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $graphics.DrawString(
        'Built for Realism. Driven by Community.',
        $taglineFont,
        $taglineBrush,
        (New-Object System.Drawing.RectangleF(100, 344, 1600, 70)),
        $taglineFormat
    )

    $dividerPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(72, 255, 255, 255), 2)
    $graphics.DrawLine($dividerPen, 78, 438, 1722, 438)

    $logo = [System.Drawing.Image]::FromFile($logoPath)
    $logoDestination = New-Object System.Drawing.Rectangle(78, 458, 82, 92)
    $logoSource = New-Object System.Drawing.Rectangle(280, 65, 840, 1180)
    $logoAttributes = New-Object System.Drawing.Imaging.ImageAttributes
    $logoAttributes.SetColorKey(
        [System.Drawing.Color]::FromArgb(0, 0, 0),
        [System.Drawing.Color]::FromArgb(28, 28, 28)
    )
    $graphics.DrawImage(
        $logo,
        $logoDestination,
        $logoSource.X,
        $logoSource.Y,
        $logoSource.Width,
        $logoSource.Height,
        [System.Drawing.GraphicsUnit]::Pixel,
        $logoAttributes
    )

    $brandStyle = [System.Drawing.FontStyle]::Bold -bor [System.Drawing.FontStyle]::Italic
    $brandFont = New-Object System.Drawing.Font('Arial', 31, $brandStyle, [System.Drawing.GraphicsUnit]::Pixel)
    $brandSubFont = New-Object System.Drawing.Font('Arial', 18, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $graphics.DrawString('Illinois State Roleplay', $brandFont, $titleBrush, 176, 467)
    $graphics.DrawString("Illinois' Premier Roleplay", $brandSubFont, $taglineBrush, 178, 512)

    $outputPath = Join-Path $OutputDirectory $FileName
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $logoAttributes.Dispose()
    $logo.Dispose()
    $brandSubFont.Dispose()
    $brandFont.Dispose()
    $dividerPen.Dispose()
    $taglineFormat.Dispose()
    $taglineBrush.Dispose()
    $taglineFont.Dispose()
    $titleFormat.Dispose()
    $titleBrush.Dispose()
    $titleFont.Dispose()
    $smallBrush.Dispose()
    $smallFont.Dispose()
    $innerBorder.Dispose()
    $innerFill.Dispose()
    $innerPath.Dispose()
    $glow.Dispose()
    $gradient.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()

    Write-Output $outputPath
}

$banners = @(
    @{ Title = 'ASSISTANCE'; FileName = 'assistance-banner-v2.png' },
    @{ Title = 'SESSIONS'; FileName = 'sessions-banner-v2.png' },
    @{ Title = 'WELCOME'; FileName = 'welcome-banner-v2.png' },
    @{ Title = 'STAFF GUIDE'; FileName = 'staff-guide-banner-v3.png' },
    @{ Title = 'ABOUT'; FileName = 'about-banner-v1.png' },
    @{ Title = 'DASHBOARD'; FileName = 'dashboard-banner-v1.png' },
    @{ Title = 'ANNOUNCEMENTS'; FileName = 'announcements-banner-v1.png' }
)

foreach ($banner in $banners) {
    New-ISRPBanner -Title $banner.Title -FileName $banner.FileName
}
