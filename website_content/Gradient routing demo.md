---
title: Creating Interpretable Latent Spaces with Gradient Routing
permalink: gradient-routing-demo
publish: true
no_dropcap: "false"
tags:
  - AI
  - mats-program
description: Our gradient routing technique can force an interpretable inner representation.
  Each dimension corresponds to a digit. Play with a demo!
authors: Jacob Goldman-Wetzler
hideSubscriptionLinks: true
card_image: https://assets.turntrout.com/static/images/card_images/NO2S3mX.png
aliases:
  - gr-demo
  - routing-demo
  - mnist-partition-demo
lw-linkpost-url: https://jacobgw.com/blog/ml/2024/12/12/interp-latent.html
date_published: 2024-12-16 17:42:14.364997
date_updated: 2025-03-05 20:43:54.692493
---





Over the past few months, I helped develop [Gradient Routing](/gradient-routing), a non loss-based method to shape the internals of neural networks. After my team developed it, I realized that I could use the method to do something that I have long wanted to do: make an autoencoder with an extremely interpretable latent space.

I created an MNIST autoencoder with a 10-dimensional latent space, with each dimension of the latent space corresponding to a different digit. Before I get into how I did it, feel free to play around with my [demo](https://jacobgw.com/gradient-routed-vae/) - it loads the model into the browser.

<iframe height="1360" width="500" src="https://jacobgw.com/gradient-routed-vae/" title="Demo"></iframe>

In the demo, you can both see how a random MNIST image encodes but also directly play around with the encoding itself and create different types of digits by just moving the sliders.

The reconstruction is not that good, and I assume this is due to some combination of:

1. Using the simplest possible architecture of MLP layers and ReLU;
2. Only allowing a 10-dimensional latent space which could constrain the representation a lot;
3. Not doing data augmentation, so it might not generalize that well; and
4. Gradient routing targeting an unnatural internal representation, causing the autoencoder to not fit the data that well.

This was just supposed to be a fun proof-of-concept project, so I’m not too worried about the reconstruction not being that good.

# How it works

My implementation of gradient routing is super simple and easy to add onto a variational autoencoder. During training, after I run the encoder, I just detach every dimension of the encoding except for the one corresponding to the label of the image:

```python
def encode_and_mask(self, images: Tensor, labels: Tensor):
    encoded_unmasked, zeta, mean_from_encoded, cov_diag_from_encoded = self.encode(
        images
    )
    mask_one_hot = F.one_hot(labels, num_classes=self.latent_size).float()
    encoded = (
        mask_one_hot * encoded_unmasked
        + (1 - mask_one_hot) * encoded_unmasked.detach()
    )
    return encoded, zeta, mean_from_encoded, cov_diag_from_encoded
```

This causes each dimension of the latent space to “specialize” to representing its corresponding image since the error for that image type can only be propagated through the single dimension of the latent space. It turns out that if you do this, nothing forces the model to represent “more of a digit” in the positive direction. Sometimes the model represented “5-ness” in the negative direction in the latent space (e.g. as `[0, 0, 0, 0, 0, -1.0, 0, 0, 0, 0]`).

This messed with my demo a bit since I wanted all the sliders to only go in the positive direction. My solution? Just apply a ReLU to the encoding so it can only represent positive numbers! This design choice is obviously not practical and I only included it so the demo would look nice.[^1]

In our [Gradient Routing paper](https://arxiv.org/pdf/2410.04332), we found that models sometimes needed regularization to split the representations well. However, in this setting, I’m not applying any regularization besides the default regularization of the encoding that comes with a variational autoencoder. I guess it turns out that this regularization is enough to effectively split the digits.

# Classification

It turns out that even though there was *no* loss function causing the encoding to activate most strongly on the dimension corresponding to the digit being encoded, it happened! In fact, we can *classify* digits to **92.58%** accuracy by just taking the *argmax* over the encoding, which I find pretty amazing.

# Code

You can see the code [here](https://github.com/g-w1/gradient-routed-vae).

[^1]: I did have to train the model a few times to get something that behaved nicely enough for the demo.
