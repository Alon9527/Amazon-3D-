param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [string]$OutputPath = (Join-Path $PSScriptRoot '..\build\icon.png'),

  [ValidateRange(256, 2048)]
  [int]$Size = 1024
)

$ErrorActionPreference = 'Stop'

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path -Parent $resolvedOutput

if (-not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class InspectorIconPreparer
{
    private static bool IsConnectedCanvasPixel(byte[] pixels, int offset)
    {
        int blue = pixels[offset];
        int green = pixels[offset + 1];
        int red = pixels[offset + 2];
        int maximum = Math.Max(red, Math.Max(green, blue));
        int minimum = Math.Min(red, Math.Min(green, blue));

        return red >= 120 && green >= 120 && blue >= 120 && maximum - minimum <= 40;
    }

    private static void TryQueue(
        int x,
        int y,
        byte[] pixels,
        byte[] visited,
        int[] queue,
        ref int tail,
        int width,
        int height,
        int stride)
    {
        if (x < 0 || y < 0 || x >= width || y >= height)
        {
            return;
        }

        int index = y * width + x;
        if (visited[index] != 0)
        {
            return;
        }

        int offset = y * stride + x * 4;
        if (!IsConnectedCanvasPixel(pixels, offset))
        {
            return;
        }

        visited[index] = 1;
        queue[tail++] = index;
    }

    public static void Convert(string inputPath, string outputPath, int size)
    {
        using (var source = new Bitmap(inputPath))
        using (var bitmap = new Bitmap(size, size, PixelFormat.Format32bppArgb))
        {
            using (var graphics = Graphics.FromImage(bitmap))
            {
                graphics.Clear(Color.Transparent);
                graphics.CompositingMode = CompositingMode.SourceCopy;
                graphics.CompositingQuality = CompositingQuality.HighQuality;
                graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                graphics.SmoothingMode = SmoothingMode.HighQuality;
                graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
                graphics.DrawImage(source, new Rectangle(0, 0, size, size));
            }

            var bounds = new Rectangle(0, 0, bitmap.Width, bitmap.Height);
            var data = bitmap.LockBits(bounds, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);

            try
            {
                int byteCount = Math.Abs(data.Stride) * data.Height;
                var pixels = new byte[byteCount];
                Marshal.Copy(data.Scan0, pixels, 0, byteCount);

                int width = bitmap.Width;
                int height = bitmap.Height;
                int stride = data.Stride;
                var visited = new byte[width * height];
                var queue = new int[width * height];
                int head = 0;
                int tail = 0;

                for (int x = 0; x < width; x++)
                {
                    TryQueue(x, 0, pixels, visited, queue, ref tail, width, height, stride);
                    TryQueue(x, height - 1, pixels, visited, queue, ref tail, width, height, stride);
                }

                for (int y = 1; y < height - 1; y++)
                {
                    TryQueue(0, y, pixels, visited, queue, ref tail, width, height, stride);
                    TryQueue(width - 1, y, pixels, visited, queue, ref tail, width, height, stride);
                }

                while (head < tail)
                {
                    int index = queue[head++];
                    int x = index % width;
                    int y = index / width;
                    int offset = y * stride + x * 4;

                    pixels[offset] = 0;
                    pixels[offset + 1] = 0;
                    pixels[offset + 2] = 0;
                    pixels[offset + 3] = 0;

                    TryQueue(x - 1, y, pixels, visited, queue, ref tail, width, height, stride);
                    TryQueue(x + 1, y, pixels, visited, queue, ref tail, width, height, stride);
                    TryQueue(x, y - 1, pixels, visited, queue, ref tail, width, height, stride);
                    TryQueue(x, y + 1, pixels, visited, queue, ref tail, width, height, stride);
                    TryQueue(x - 1, y - 1, pixels, visited, queue, ref tail, width, height, stride);
                    TryQueue(x + 1, y - 1, pixels, visited, queue, ref tail, width, height, stride);
                    TryQueue(x - 1, y + 1, pixels, visited, queue, ref tail, width, height, stride);
                    TryQueue(x + 1, y + 1, pixels, visited, queue, ref tail, width, height, stride);
                }

                Marshal.Copy(pixels, 0, data.Scan0, byteCount);
            }
            finally
            {
                bitmap.UnlockBits(data);
            }

            bitmap.Save(outputPath, ImageFormat.Png);
        }
    }
}
'@

[InspectorIconPreparer]::Convert($resolvedInput, $resolvedOutput, $Size)

$result = [System.Drawing.Bitmap]::FromFile($resolvedOutput)
try {
  $corner = $result.GetPixel(0, 0)
  if ($corner.A -ne 0) {
    throw "Icon preparation failed: corner alpha is $($corner.A), expected 0."
  }

  Write-Output "Prepared $($result.Width)x$($result.Height) icon: $resolvedOutput"
} finally {
  $result.Dispose()
}
