"""Four-channel experimental networks shared by training, evaluation and inference."""

import torch
import torch.nn as nn


class ConvBlock(nn.Module):
    def __init__(self, in_c: int, out_c: int, stride: int = 1):
        super().__init__()
        self.conv = nn.Conv2d(in_c, out_c, kernel_size=3, stride=stride, padding=1, bias=False)
        self.bn = nn.BatchNorm2d(out_c)
        self.act = nn.LeakyReLU(0.1, inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.act(self.bn(self.conv(x)))

class PyTorchDetectionAndLocator(nn.Module):
    def __init__(self, in_channels: int = 4):
        super().__init__()
        self.features = nn.Sequential(
            ConvBlock(in_channels, 16, stride=2),
            ConvBlock(16, 32, stride=2),
            ConvBlock(32, 64, stride=2),
            ConvBlock(64, 128, stride=2),
            nn.AdaptiveAvgPool2d((2, 2)),
            nn.Flatten(),
        )
        self.fc_presence = nn.Linear(128 * 4, 1)
        self.fc_center = nn.Linear(128 * 4, 2)

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        feat = self.features(x)
        presence = self.fc_presence(feat)
        center_offset = torch.tanh(self.fc_center(feat))
        return presence, center_offset

class PyTorchPatternClassifier(nn.Module):
    def __init__(self, in_channels: int = 4, num_classes: int = 6):
        super().__init__()
        self.layer1 = ConvBlock(in_channels, 24, stride=2)
        self.layer2 = ConvBlock(24, 48, stride=2)
        self.layer3 = ConvBlock(48, 96, stride=2)
        self.layer4 = ConvBlock(96, 160, stride=2)
        self.pool = nn.AdaptiveAvgPool2d((1, 1))
        self.dropout = nn.Dropout(0.25)
        self.fc = nn.Linear(160, num_classes)

    def feature_maps(self, x: torch.Tensor) -> torch.Tensor:
        return self.layer4(self.layer3(self.layer2(self.layer1(x))))

    def classify_maps(self, x: torch.Tensor) -> torch.Tensor:
        pooled = self.pool(x)
        flattened = torch.flatten(pooled, 1)
        return self.fc(self.dropout(flattened))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.classify_maps(self.feature_maps(x))


class PyTorchRapidIntensificationModel(nn.Module):
    def __init__(self, in_channels: int = 4):
        super().__init__()
        self.image_encoder = nn.Sequential(
            ConvBlock(in_channels, 16, stride=2),
            ConvBlock(16, 32, stride=2),
            ConvBlock(32, 64, stride=2),
            nn.AdaptiveAvgPool2d((2, 2)),
            nn.Flatten(),
        )
        self.fc = nn.Sequential(
            nn.Linear(64 * 4 + 4, 64),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(64, 1),
        )

    def forward(self, img_tensor: torch.Tensor, ocean_telemetry: torch.Tensor) -> torch.Tensor:
        img_feat = self.image_encoder(img_tensor)
        combined = torch.cat([img_feat, ocean_telemetry], dim=1)
        return self.fc(combined)

class PyTorchIntensityRegressor(nn.Module):
    def __init__(self, in_channels: int = 4):
        super().__init__()
        self.encoder = nn.Sequential(
            ConvBlock(in_channels, 16, stride=2),
            ConvBlock(16, 32, stride=2),
            ConvBlock(32, 64, stride=2),
            nn.AdaptiveAvgPool2d((2, 2)),
            nn.Flatten(),
        )
        self.fc_intensity = nn.Sequential(
            nn.Linear(64 * 4 + 8, 128),
            nn.ReLU(),
            nn.Linear(128, 8),
        )
        self.fc_track = nn.Sequential(
            nn.Linear(64 * 4 + 8, 128),
            nn.ReLU(),
            nn.Linear(128, 8),
        )

    def forward(self, img_tensor: torch.Tensor, telemetry: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        feat = self.encoder(img_tensor)
        combined = torch.cat([feat, telemetry], dim=1)
        intensity_deltas = self.fc_intensity(combined)
        track_deltas = self.fc_track(combined)
        return intensity_deltas, track_deltas

